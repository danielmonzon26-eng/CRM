"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { graph, GraphError, isOutlookConfigured, ReconnectRequired } from "@/lib/outlook/graph";
import { getAccessToken, STALE_MS, syncAccounts } from "@/lib/outlook/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_CONFIGURED = "Outlook isn't set up on this site yet.";

type ActionResult = { error?: string };

function revalidateMail() {
  revalidatePath("/communication");
  revalidatePath("/leads/[id]", "page");
  revalidatePath("/companies/[id]", "page");
}

/**
 * Pulls new mail and meetings from Outlook. Pages call this in the background when they
 * open (skipping mailboxes synced in the last few minutes); "Sync now" forces it.
 */
export async function syncMail(force = false): Promise<{ changed: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { changed: false, error: "Sign in first." };
  if (!isOutlookConfigured()) return { changed: false };

  const results = await syncAccounts(createAdminClient(), force ? 0 : STALE_MS);
  const changed = results.some((r) => r.saved > 0 || r.removed > 0);
  if (changed) revalidateMail();
  const failed = results.find((r) => r.error);
  return { changed, error: failed ? `${failed.email}: ${failed.error}` : undefined };
}

export async function disconnectOutlook(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!isOutlookConfigured()) return { error: NOT_CONFIGURED };

  const { error } = await createAdminClient().from("mail_accounts").delete().eq("user_id", user.id);
  if (error) return { error: "Outlook wasn't disconnected. Please try again." };
  revalidateMail();
  return {};
}

function parseAddresses(value: string): string[] | null {
  const list = value
    .split(/[,;\s]+/)
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return list.every((a) => EMAIL_PATTERN.test(a)) ? [...new Set(list)] : null;
}

export type SendEmailInput = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  /** Reply in the thread of this stored email (must be in the sender's own mailbox). */
  replyToId?: string;
  /** Lead to log the email against. */
  leadId?: string;
};

/** Sends from the signed-in user's own Outlook, so it lands in their Sent Items too. */
export async function sendOutlookEmail(input: SendEmailInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!isOutlookConfigured()) return { error: NOT_CONFIGURED };

  const to = parseAddresses(input.to);
  const cc = parseAddresses(input.cc ?? "");
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to || to.length === 0) return { error: "Enter at least one valid email address in To." };
  if (!cc) return { error: "Check the Cc addresses." };
  if (to.length + cc.length > 25) return { error: "Send to 25 people or fewer." };
  if (!input.replyToId && !subject) return { error: "Add a subject." };
  if (!body) return { error: "Write a message." };
  if (subject.length > 255 || body.length > 50_000) return { error: "That message is too long." };

  const admin = createAdminClient();
  const { data: account } = await admin.from("mail_accounts").select("*").eq("user_id", user.id).maybeSingle();
  if (!account) return { error: "Connect your Outlook first, on the Communication page." };
  if (account.status !== "connected") return { error: "Your Outlook needs to be connected again, on the Communication page." };

  const recipients = (list: string[]) => list.map((address) => ({ emailAddress: { address } }));

  try {
    const token = await getAccessToken(admin, account);
    let draft: { id: string; conversationId?: string; subject?: string; webLink?: string };

    if (input.replyToId) {
      const { data: original } = await admin
        .from("emails")
        .select("graph_id, account_id")
        .eq("id", input.replyToId)
        .maybeSingle();
      if (!original || original.account_id !== account.id) return { error: "You can only reply to email in your own mailbox." };
      draft = await graph(token, `/me/messages/${encodeURIComponent(original.graph_id)}/createReply`, {
        method: "POST",
        body: { message: { toRecipients: recipients(to), ccRecipients: recipients(cc) }, comment: body },
      });
    } else {
      draft = await graph(token, "/me/messages", {
        method: "POST",
        body: { subject, body: { contentType: "Text", content: body }, toRecipients: recipients(to), ccRecipients: recipients(cc) },
      });
    }
    await graph(token, `/me/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST" });

    // Recorded now so it shows straight away; the next sync updates the same row by ID.
    const owner = account.email.toLowerCase();
    await admin.from("emails").upsert(
      {
        account_id: account.id,
        graph_id: draft.id,
        conversation_id: draft.conversationId ?? null,
        direction: "outbound",
        from_email: owner,
        from_name: account.display_name,
        to_emails: to,
        cc_emails: cc,
        participants: [...new Set([...to, ...cc])].filter((a) => a !== owner),
        subject: draft.subject ?? subject,
        preview: body.slice(0, 255),
        body,
        sent_at: new Date().toISOString(),
        is_read: true,
        web_link: draft.webLink ?? null,
      },
      { onConflict: "account_id,graph_id" }
    );

    if (input.leadId) {
      const supabase = await createClient();
      await supabase.from("activities").insert({
        lead_id: input.leadId,
        actor_id: user.id,
        type: "email_sent",
        body: `${draft.subject ?? subject} (to ${to.join(", ")})`,
      });
    }
  } catch (e) {
    console.error("Outlook send failed:", e);
    if (e instanceof ReconnectRequired) return { error: "Your Outlook needs to be connected again, on the Communication page." };
    if (e instanceof GraphError && e.status === 403) return { error: "Outlook didn't allow sending. Ask an admin to check the app's permissions." };
    return { error: "The email wasn't sent. Please try again." };
  }

  revalidateMail();
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  return {};
}
