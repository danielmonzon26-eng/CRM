import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { Database } from "@/lib/supabase/types";
import { decryptToken, encryptToken } from "./crypto";
import {
  graph,
  GraphError,
  ReconnectRequired,
  refreshAccessToken,
  type GraphAddress,
  type GraphEvent,
  type GraphMessage,
  type GraphPage,
} from "./graph";

type Admin = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["mail_accounts"]["Row"];
type EmailInsert = Database["public"]["Tables"]["emails"]["Insert"];
type MeetingInsert = Database["public"]["Tables"]["meetings"]["Insert"];

/** How far back the first sync of a mailbox reaches. */
const HISTORY_DAYS = 90;
/** Calendar window kept in step with Outlook on every sync. */
const MEETINGS_PAST_DAYS = 30;
const MEETINGS_AHEAD_DAYS = 90;
/** Pages per folder per run, so one sync stays well inside the function time limit. */
const MAX_PAGES = 10;
/** A sync that started this recently is assumed to still be running. */
const LOCK_MS = 3 * 60 * 1000;
/** Background syncs (opening a page) skip mailboxes synced this recently. */
export const STALE_MS = 5 * 60 * 1000;
const BODY_LIMIT = 20_000;

const MESSAGE_FIELDS =
  "id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,isRead,isDraft,hasAttachments,webLink";

export type SyncResult = { accountId: string; email: string; saved: number; removed: number; error?: string };

function address(a: GraphAddress | undefined): string | null {
  const value = a?.emailAddress?.address?.trim().toLowerCase();
  return value ? value : null;
}

function addresses(list: GraphAddress[] | undefined): string[] {
  return (list ?? []).map(address).filter((a): a is string => a !== null);
}

/** Every lowercased contact email in the CRM. */
export async function loadContactEmails(admin: Admin): Promise<Set<string>> {
  const rows = await fetchAllPages((from, to) =>
    admin.from("contacts").select("email").not("email", "is", null).range(from, to)
  );
  return new Set(rows.map((r) => r.email!.trim().toLowerCase()).filter(Boolean));
}

/** Turns a Graph message into a row, or null when no known contact is on it. */
export function toEmailRow(
  message: GraphMessage,
  account: Pick<Account, "id" | "email">,
  folder: "inbox" | "sent",
  contacts: Set<string>
): EmailInsert | null {
  if (message.isDraft) return null;
  const owner = account.email.toLowerCase();
  const from = address(message.from);
  const to = addresses(message.toRecipients);
  const cc = addresses(message.ccRecipients);
  const participants = [...new Set([from, ...to, ...cc].filter((a): a is string => a !== null && a !== owner))];
  if (!participants.some((p) => contacts.has(p))) return null;

  const sentAt = (folder === "sent" ? message.sentDateTime : message.receivedDateTime) ?? message.sentDateTime;
  if (!sentAt) return null;

  return {
    account_id: account.id,
    graph_id: message.id,
    conversation_id: message.conversationId ?? null,
    direction: folder === "sent" || from === owner ? "outbound" : "inbound",
    from_email: from,
    from_name: message.from?.emailAddress?.name ?? null,
    to_emails: to,
    cc_emails: cc,
    participants,
    subject: message.subject ?? null,
    preview: message.bodyPreview ?? null,
    body: message.body?.content?.slice(0, BODY_LIMIT) ?? null,
    sent_at: sentAt,
    is_read: folder === "sent" ? true : (message.isRead ?? true),
    has_attachments: message.hasAttachments ?? false,
    web_link: message.webLink ?? null,
  };
}

/** Turns a Graph calendar event into a row, or null when no known contact attends. */
export function toMeetingRow(
  event: GraphEvent,
  account: Pick<Account, "id" | "email">,
  contacts: Set<string>
): MeetingInsert | null {
  if (event.isCancelled || !event.start || !event.end) return null;
  const owner = account.email.toLowerCase();
  const organizer = address(event.organizer);
  const participants = [...new Set([organizer, ...addresses(event.attendees)].filter((a): a is string => a !== null && a !== owner))];
  if (!participants.some((p) => contacts.has(p))) return null;

  // Requested with Prefer: outlook.timezone="UTC", so these are UTC without an offset.
  const utc = (value: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toISOString();
  return {
    account_id: account.id,
    graph_id: event.id,
    subject: event.subject ?? null,
    starts_at: utc(event.start.dateTime),
    ends_at: utc(event.end.dateTime),
    is_all_day: event.isAllDay ?? false,
    location: event.location?.displayName || null,
    online_url: event.onlineMeeting?.joinUrl ?? null,
    organizer_email: organizer,
    participants,
    web_link: event.webLink ?? null,
  };
}

/** A fresh access token for the account, saving Microsoft's rotated refresh token. */
export async function getAccessToken(admin: Admin, account: Account): Promise<string> {
  try {
    const token = await refreshAccessToken(decryptToken(account.refresh_token));
    if (token.refresh_token) {
      await admin
        .from("mail_accounts")
        .update({ refresh_token: encryptToken(token.refresh_token), status: "connected" })
        .eq("id", account.id);
    }
    return token.access_token;
  } catch (e) {
    if (e instanceof ReconnectRequired) {
      await admin
        .from("mail_accounts")
        .update({ status: "needs_reconnect", last_error: "Outlook needs to be connected again." })
        .eq("id", account.id);
    }
    throw e;
  }
}

function initialLink(folder: "inbox" | "sentitems"): string {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const params = new URLSearchParams({ $select: MESSAGE_FIELDS, $filter: `receivedDateTime ge ${since}` });
  return `/me/mailFolders/${folder}/messages/delta?${params}`;
}

async function syncFolder(
  admin: Admin,
  token: string,
  account: Account,
  folder: "inbox" | "sent",
  contacts: Set<string>
): Promise<{ saved: number; removed: number }> {
  const column = folder === "inbox" ? "inbox_sync_link" : "sent_sync_link";
  let link = account[column] ?? initialLink(folder === "inbox" ? "inbox" : "sentitems");
  let saved = 0;
  let removed = 0;

  for (let pageCount = 0; pageCount < MAX_PAGES; pageCount++) {
    let page: GraphPage<GraphMessage>;
    try {
      page = await graph<GraphPage<GraphMessage>>(token, link, {
        prefer: ["odata.maxpagesize=50", 'outlook.body-content-type="text"'],
      });
    } catch (e) {
      // An expired delta link (410 Gone / syncStateNotFound) restarts from the history window.
      if (e instanceof GraphError && (e.status === 410 || e.code === "syncStateNotFound") && account[column]) {
        link = initialLink(folder === "inbox" ? "inbox" : "sentitems");
        account = { ...account, [column]: null };
        continue;
      }
      throw e;
    }

    const removedIds = page.value.filter((m) => m["@removed"]).map((m) => m.id);
    if (removedIds.length > 0) {
      const { count } = await admin
        .from("emails")
        .delete({ count: "exact" })
        .eq("account_id", account.id)
        .in("graph_id", removedIds);
      removed += count ?? 0;
    }

    const rows = page.value
      .filter((m) => !m["@removed"])
      .map((m) => toEmailRow(m, account, folder, contacts))
      .filter((r): r is EmailInsert => r !== null);
    if (rows.length > 0) {
      const { error } = await admin.from("emails").upsert(rows, { onConflict: "account_id,graph_id" });
      if (error) throw new Error(error.message);
      saved += rows.length;
    }

    // Save progress after every page so a run that stops early resumes here next time.
    const next = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
    if (!next) break;
    link = next;
    await admin
      .from("mail_accounts")
      .update(column === "inbox_sync_link" ? { inbox_sync_link: next } : { sent_sync_link: next })
      .eq("id", account.id);
    if (!page["@odata.nextLink"]) break;
  }

  return { saved, removed };
}

async function syncMeetings(admin: Admin, token: string, account: Account, contacts: Set<string>): Promise<number> {
  const start = new Date(Date.now() - MEETINGS_PAST_DAYS * 86_400_000);
  const end = new Date(Date.now() + MEETINGS_AHEAD_DAYS * 86_400_000);
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: "id,subject,start,end,isAllDay,isCancelled,location,onlineMeeting,organizer,attendees,webLink",
    $top: "100",
  });

  const rows: MeetingInsert[] = [];
  let link: string | undefined = `/me/calendarView?${params}`;
  let complete = false;
  for (let pageCount = 0; link && pageCount < MAX_PAGES; pageCount++) {
    const page: GraphPage<GraphEvent> = await graph<GraphPage<GraphEvent>>(token, link, {
      prefer: ['outlook.timezone="UTC"'],
    });
    rows.push(...page.value.map((e) => toMeetingRow(e, account, contacts)).filter((r): r is MeetingInsert => r !== null));
    link = page["@odata.nextLink"];
    if (!link) complete = true;
  }

  if (rows.length > 0) {
    const { error } = await admin.from("meetings").upsert(rows, { onConflict: "account_id,graph_id" });
    if (error) throw new Error(error.message);
  }

  // Meetings in the window that Outlook no longer returns were cancelled or deleted.
  // Only safe to prune when every page was read.
  if (complete) {
    const keep = rows.map((r) => r.graph_id);
    let prune = admin
      .from("meetings")
      .delete()
      .eq("account_id", account.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString());
    if (keep.length > 0) prune = prune.not("graph_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
    await prune;
  }
  return rows.length;
}

/** Claims the account so two syncs of one mailbox never overlap. */
async function claim(admin: Admin, accountId: string): Promise<Account | null> {
  const cutoff = new Date(Date.now() - LOCK_MS).toISOString();
  const { data } = await admin
    .from("mail_accounts")
    .update({ sync_started_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("status", "connected")
    .or(`sync_started_at.is.null,sync_started_at.lt.${cutoff}`)
    .select("*")
    .maybeSingle();
  return data;
}

export async function syncAccount(admin: Admin, accountId: string, contacts?: Set<string>): Promise<SyncResult | null> {
  const account = await claim(admin, accountId);
  if (!account) return null;

  const result: SyncResult = { accountId, email: account.email, saved: 0, removed: 0 };
  try {
    const known = contacts ?? (await loadContactEmails(admin));
    const token = await getAccessToken(admin, account);
    for (const folder of ["inbox", "sent"] as const) {
      const r = await syncFolder(admin, token, account, folder, known);
      result.saved += r.saved;
      result.removed += r.removed;
    }
    result.saved += await syncMeetings(admin, token, account, known);
    await admin
      .from("mail_accounts")
      .update({ last_synced_at: new Date().toISOString(), last_error: null, sync_started_at: null })
      .eq("id", accountId);
  } catch (e) {
    result.error = e instanceof ReconnectRequired ? "Outlook needs to be connected again." : e instanceof Error ? e.message : String(e);
    console.error(`Outlook sync failed for ${account.email}:`, e);
    await admin
      .from("mail_accounts")
      .update({ last_error: result.error.slice(0, 500), sync_started_at: null })
      .eq("id", accountId);
  }
  return result;
}

/** Syncs every connected mailbox, or only those not synced within `staleMs`. */
export async function syncAccounts(admin: Admin, staleMs = 0): Promise<SyncResult[]> {
  const { data: accounts, error } = await admin
    .from("mail_accounts")
    .select("id, last_synced_at")
    .eq("status", "connected");
  if (error) throw new Error(error.message);

  const due = (accounts ?? []).filter(
    (a) => !a.last_synced_at || Date.now() - new Date(a.last_synced_at).getTime() >= staleMs
  );
  if (due.length === 0) return [];

  const contacts = await loadContactEmails(admin);
  const results = await Promise.all(due.map((a) => syncAccount(admin, a.id, contacts)));
  return results.filter((r): r is SyncResult => r !== null);
}
