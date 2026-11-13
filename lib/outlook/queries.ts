import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { EmailDirection, MailAccountStatus } from "@/lib/supabase/types";

// mail_accounts.refresh_token isn't readable by signed-in users, so always list columns.
const ACCOUNT_COLUMNS = "id, user_id, email, display_name, status, last_synced_at, last_error";
const EMAIL_COLUMNS =
  "id, account_id, conversation_id, direction, from_email, from_name, to_emails, cc_emails, participants, subject, preview, body, sent_at, is_read, has_attachments, web_link";
const MEETING_COLUMNS =
  "id, account_id, subject, starts_at, ends_at, is_all_day, location, online_url, organizer_email, participants, web_link";

// Formatted on the server so the page matches when it loads in the browser.
const dateTime = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Edmonton",
});

export type MailAccount = {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  status: MailAccountStatus;
  lastSyncedAt: string | null;
  lastSyncedLabel: string | null;
  lastError: string | null;
};

export type ContactRef = { id: string; name: string; email: string; leadId: string; companyName: string | null };

export type EmailItem = {
  id: string;
  accountId: string;
  mailbox: string;
  isMine: boolean;
  direction: EmailDirection;
  fromName: string | null;
  fromEmail: string | null;
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  body: string;
  sentAt: string;
  sentLabel: string;
  isRead: boolean;
  hasAttachments: boolean;
  webLink: string | null;
  needsReply: boolean;
  /** Received, recent, and not yet opened in the CRM by the person viewing. */
  isNew: boolean;
  contacts: ContactRef[];
};

export type MeetingItem = {
  id: string;
  mailbox: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  location: string | null;
  onlineUrl: string | null;
  webLink: string | null;
  contacts: ContactRef[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toAccount(row: {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  status: MailAccountStatus;
  last_synced_at: string | null;
  last_error: string | null;
}): MailAccount {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    lastSyncedLabel: row.last_synced_at ? dateTime.format(new Date(row.last_synced_at)) : null,
    lastError: row.last_error,
  };
}

/** Whether this user can send from the CRM: Outlook is set up and their mailbox is connected. */
export async function canUserSend(userId: string): Promise<boolean> {
  const { isOutlookConfigured } = await import("./graph");
  if (!isOutlookConfigured()) return false;
  const accounts = await getMailAccounts();
  return accounts.some((a) => a.userId === userId && a.status === "connected");
}

export async function getMailAccounts(): Promise<MailAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mail_accounts").select(ACCOUNT_COLUMNS).order("email");
  if (error) throw error;
  return data.map(toAccount);
}

/** Contacts on any of `addresses`, keyed by lowercased email, with their company. */
async function contactsByEmail(supabase: Supabase, addresses: string[]): Promise<Map<string, ContactRef>> {
  const wanted = new Set(addresses);
  const map = new Map<string, ContactRef>();
  if (wanted.size === 0) return map;

  const contacts = await fetchAllPages((from, to) =>
    supabase.from("contacts").select("id, full_name, email, lead_id").not("email", "is", null).range(from, to)
  );
  const matched = contacts.filter((c) => wanted.has(c.email!.trim().toLowerCase()));
  if (matched.length === 0) return map;

  const leadIds = [...new Set(matched.map((c) => c.lead_id))];
  const { data: leads, error: leadsError } = await supabase.from("leads").select("id, company_id").in("id", leadIds);
  if (leadsError) throw leadsError;
  const companyIds = [...new Set(leads.map((l) => l.company_id))];
  const { data: companies, error: companiesError } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [], error: null };
  if (companiesError) throw companiesError;
  const nameByCompany = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const companyByLead = new Map((leads ?? []).map((l) => [l.id, nameByCompany.get(l.company_id) ?? null]));

  for (const c of matched) {
    const email = c.email!.trim().toLowerCase();
    if (!map.has(email)) {
      map.set(email, { id: c.id, name: c.full_name, email, leadId: c.lead_id, companyName: companyByLead.get(c.lead_id) ?? null });
    }
  }
  return map;
}

type EmailRow = {
  id: string;
  account_id: string;
  conversation_id: string | null;
  direction: EmailDirection;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  participants: string[];
  subject: string | null;
  preview: string | null;
  body: string | null;
  sent_at: string;
  is_read: boolean;
  has_attachments: boolean;
  web_link: string | null;
};

async function decorateEmails(supabase: Supabase, rows: EmailRow[], currentUserId: string): Promise<EmailItem[]> {
  const [accounts, contacts, newIds] = await Promise.all([
    getMailAccounts(),
    contactsByEmail(supabase, [...new Set(rows.flatMap((r) => r.participants))]),
    unseenReplyIds(supabase),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Rows arrive newest first, so the first row seen per conversation is its latest message.
  const seenConversation = new Set<string>();
  return rows.map((r) => {
    const key = `${r.account_id}:${r.conversation_id ?? r.id}`;
    const isLatest = !seenConversation.has(key);
    seenConversation.add(key);
    const account = accountById.get(r.account_id);
    return {
      id: r.id,
      accountId: r.account_id,
      mailbox: account?.email ?? "",
      isMine: account?.userId === currentUserId,
      direction: r.direction,
      fromName: r.from_name,
      fromEmail: r.from_email,
      to: r.to_emails,
      cc: r.cc_emails,
      subject: r.subject?.trim() || "(no subject)",
      preview: r.preview ?? "",
      body: r.body ?? r.preview ?? "",
      sentAt: r.sent_at,
      sentLabel: dateTime.format(new Date(r.sent_at)),
      isRead: r.is_read,
      hasAttachments: r.has_attachments,
      webLink: r.web_link,
      needsReply: isLatest && r.direction === "inbound",
      isNew: newIds.has(r.id),
      contacts: r.participants.map((p) => contacts.get(p)).filter((c): c is ContactRef => c !== undefined),
    };
  });
}

/**
 * Ids of received email the viewer hasn't opened here yet. Only the "New" markers depend
 * on this, so a failure is logged and shows nothing as new rather than hiding the email.
 */
async function unseenReplyIds(supabase: Supabase): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("unseen_reply_ids");
  if (error) {
    console.error("Unseen email lookup failed:", error);
    return new Set();
  }
  return new Set((data ?? []) as string[]);
}

/** The number on the Communication nav link. */
export async function getUnseenReplyCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unseen_reply_count");
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export type InboxFilter = "all" | "unread" | "needs_reply";

/** The Communication page list: recent email with any contact, newest first. */
export async function getInbox(currentUserId: string, filter: InboxFilter, limit = 200): Promise<EmailItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("emails").select(EMAIL_COLUMNS).order("sent_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const items = await decorateEmails(supabase, data as EmailRow[], currentUserId);
  if (filter === "unread") return items.filter((e) => e.direction === "inbound" && !e.isRead);
  if (filter === "needs_reply") return items.filter((e) => e.needsReply);
  return items;
}

/** Email with any of the given contact addresses (a lead's or company's contacts). */
export async function getEmailsForAddresses(addresses: string[], currentUserId: string, limit = 50): Promise<EmailItem[]> {
  const wanted = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("emails")
    .select(EMAIL_COLUMNS)
    .overlaps("participants", wanted)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return decorateEmails(supabase, data as EmailRow[], currentUserId);
}

type MeetingRow = {
  id: string;
  account_id: string;
  subject: string | null;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  location: string | null;
  online_url: string | null;
  organizer_email: string | null;
  participants: string[];
  web_link: string | null;
};

async function decorateMeetings(supabase: Supabase, rows: MeetingRow[]): Promise<MeetingItem[]> {
  const [accounts, contacts] = await Promise.all([
    getMailAccounts(),
    contactsByEmail(supabase, [...new Set(rows.flatMap((r) => r.participants))]),
  ]);
  const mailboxById = new Map(accounts.map((a) => [a.id, a.email]));

  // The same meeting shows in each attendee's calendar; list it once.
  const seen = new Set<string>();
  return rows
    .filter((r) => {
      const key = `${r.subject}|${r.starts_at}|${r.organizer_email}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({
      id: r.id,
      mailbox: mailboxById.get(r.account_id) ?? "",
      subject: r.subject?.trim() || "(no title)",
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      isAllDay: r.is_all_day,
      location: r.location,
      onlineUrl: r.online_url,
      webLink: r.web_link,
      contacts: r.participants.map((p) => contacts.get(p)).filter((c): c is ContactRef => c !== undefined),
    }));
}

/** Meetings with contacts from today onward, soonest first. */
export async function getUpcomingMeetings(limit = 20): Promise<MeetingItem[]> {
  const supabase = await createClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .gte("ends_at", today.toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw error;
  return decorateMeetings(supabase, data as MeetingRow[]);
}

/** Past and upcoming meetings with any of the given contact addresses. */
export async function getMeetingsForAddresses(addresses: string[], limit = 30): Promise<MeetingItem[]> {
  const wanted = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .overlaps("participants", wanted)
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return decorateMeetings(supabase, data as MeetingRow[]);
}
