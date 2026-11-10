"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { formatEventWhen } from "@/lib/events/format";
import { graph, isOutlookConfigured, ReconnectRequired } from "@/lib/outlook/graph";
import { getAccessToken } from "@/lib/outlook/sync";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Exchange Online allows about 30 messages a minute from one mailbox, so sends are spaced
// out, and each call sends a batch the browser repeats until everyone has theirs.
const BATCH_SIZE = 20;
const GAP_MS = 2100;

type Result = { error?: string };
export type Audience = "attended" | "registered";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes a personal feedback link for each attendee who doesn't have one yet. "attended"
 * means checked in; "registered" means everyone registered (not cancelled or waitlisted).
 */
export async function prepareFeedbackRequests(eventId: string, audience: Audience): Promise<Result & { added?: number; total?: number }> {
  const supabase = await createClient();
  let query = supabase.from("event_registrations").select("id, full_name, email").eq("event_id", eventId).eq("status", "registered");
  if (audience === "attended") query = query.not("checked_in_at", "is", null);
  const { data: registrations, error } = await query;
  if (error) return { error: "The attendee list didn't load. Please try again." };
  if (!registrations.length) return { error: audience === "attended" ? "Nobody has been checked in for this event." : "Nobody is registered for this event." };

  const { data: existing } = await supabase.from("event_feedback").select("registration_id").eq("event_id", eventId);
  const have = new Set((existing ?? []).map((r) => r.registration_id));
  const toAdd = registrations.filter((r) => !have.has(r.id));
  if (toAdd.length) {
    const { error: insertError } = await supabase
      .from("event_feedback")
      .insert(toAdd.map((r) => ({ event_id: eventId, registration_id: r.id, full_name: r.full_name, email: r.email.trim().toLowerCase() })));
    if (insertError) return { error: "The feedback links weren't created. Please try again." };
  }
  revalidatePath(`/events/${eventId}`);
  return { added: toAdd.length, total: registrations.length };
}

/** Connected Outlook mailboxes that feedback can be sent from, Daniel's first. */
export async function listFeedbackMailboxes(): Promise<{ id: string; email: string; name: string | null }[]> {
  if (!isOutlookConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("mail_accounts").select("id, email, display_name, status").eq("status", "connected");
  const isDaniel = (a: { email: string; display_name: string | null }) => /daniel/i.test(`${a.email} ${a.display_name ?? ""}`);
  return (data ?? [])
    .sort((a, b) => Number(isDaniel(b)) - Number(isDaniel(a)) || a.email.localeCompare(b.email))
    .map((a) => ({ id: a.id, email: a.email, name: a.display_name }));
}

function emailBody(firstName: string, eventTitle: string, when: string, link: string, sender: string) {
  return [
    `Hi ${firstName || "there"},`,
    "",
    `Thank you for coming to ${eventTitle} (${when}).`,
    "",
    "Could you take two minutes to tell us how it went? Your answers help us plan the next one:",
    link,
    "",
    "Thank you,",
    sender,
    "Catapult",
  ].join("\n");
}

/**
 * Sends the next batch of feedback emails from the chosen Outlook mailbox. Returns how many
 * went out and how many are still waiting, so the page can call again until it's done.
 */
export async function sendFeedbackBatch(eventId: string, accountId: string): Promise<Result & { sent?: number; failed?: number; remaining?: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!isOutlookConfigured()) return { error: "Outlook isn't set up yet. Download the links instead." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: event }, { data: account }, { data: pending }] = await Promise.all([
    supabase.from("events").select("title, starts_at, ends_at").eq("id", eventId).maybeSingle(),
    admin.from("mail_accounts").select("*").eq("id", accountId).maybeSingle(),
    supabase
      .from("event_feedback")
      .select("id, full_name, email, token")
      .eq("event_id", eventId)
      .is("request_sent_at", null)
      .is("submitted_at", null)
      .is("send_error", null)
      .order("created_at")
      .limit(BATCH_SIZE),
  ]);
  if (!event) return { error: "That event wasn't found." };
  if (!account || account.status !== "connected") return { error: "That mailbox needs to be connected again on the Communication page." };

  let token: string;
  try {
    token = await getAccessToken(admin, account);
  } catch (e) {
    return { error: e instanceof ReconnectRequired ? "That mailbox needs to be connected again on the Communication page." : "Couldn't reach Outlook. Please try again." };
  }

  const siteUrl = await getSiteUrl();
  const when = formatEventWhen(event.starts_at, null);
  const sender = account.display_name ?? account.email;
  let sent = 0;
  let failed = 0;
  for (const [i, row] of (pending ?? []).entries()) {
    if (i > 0) await sleep(GAP_MS);
    if (!row.email) continue;
    try {
      await graph(token, "/me/sendMail", {
        method: "POST",
        body: {
          message: {
            subject: `How was ${event.title}?`,
            body: { contentType: "Text", content: emailBody(row.full_name?.split(" ")[0] ?? "", event.title, when, `${siteUrl}/feedback/${row.token}`, sender) },
            toRecipients: [{ emailAddress: { address: row.email, name: row.full_name ?? undefined } }],
          },
          saveToSentItems: true,
        },
      });
      await supabase.from("event_feedback").update({ request_sent_at: new Date().toISOString(), send_error: null }).eq("id", row.id);
      sent++;
    } catch (e) {
      failed++;
      // Marked as tried, so a bad address doesn't block the rest; it can be retried later.
      await supabase
        .from("event_feedback")
        .update({ request_sent_at: null, send_error: (e instanceof Error ? e.message : "Send failed").slice(0, 300) })
        .eq("id", row.id);
      if (e instanceof ReconnectRequired) return { error: "That mailbox needs to be connected again on the Communication page.", sent, failed };
    }
  }

  const { count } = await supabase
    .from("event_feedback")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("request_sent_at", null)
    .is("submitted_at", null)
    .is("send_error", null);
  revalidatePath(`/events/${eventId}`);
  return { sent, failed, remaining: count ?? 0 };
}

/** Lets failed sends be tried again on the next batch. */
export async function retryFailedFeedback(eventId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("event_feedback").update({ send_error: null }).eq("event_id", eventId).is("request_sent_at", null).not("send_error", "is", null);
  if (error) return { error: "That didn't work. Please try again." };
  revalidatePath(`/events/${eventId}`);
  return {};
}

/** Name, email and personal link for everyone, for a mail merge when Outlook isn't connected. */
export async function feedbackLinks(eventId: string): Promise<{ rows?: [string, string, string, string][]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_feedback").select("full_name, email, token, submitted_at").eq("event_id", eventId).order("full_name");
  if (error) return { error: "The links didn't load." };
  const siteUrl = await getSiteUrl();
  return {
    rows: data.map((r) => [r.full_name ?? "", r.email ?? "", `${siteUrl}/feedback/${r.token}`, r.submitted_at ? "Responded" : ""]),
  };
}
