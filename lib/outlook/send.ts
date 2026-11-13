import { graph } from "./graph";

/**
 * The only way the CRM sends email to anyone outside the team. Every send goes through
 * here so one switch controls all of it:
 *  - OUTBOUND_EMAIL=off stops every send (they fail with a clear message).
 *  - OUTBOUND_TEST_ADDRESS sends everything to that one address instead, with the real
 *    recipients named in the subject. Outside the live site (any non-production deploy or
 *    a local copy) a test address is required, so a preview or a test run can never email
 *    a real contact.
 */

export class SendBlocked extends Error {}

export type OutboundMessage = {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  toNames?: Record<string, string>;
};

export type SentMessage = { id: string; conversationId?: string; subject?: string; webLink?: string };

type Routing = { to: string[]; cc: string[]; subjectPrefix: string };

function isLiveSite(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Where a message actually goes, or why it can't go at all. */
export function routeOutbound(to: string[], cc: string[] = []): Routing {
  if ((process.env.OUTBOUND_EMAIL ?? "").toLowerCase() === "off") {
    throw new SendBlocked("Sending email is switched off for the CRM right now.");
  }
  const testAddress = process.env.OUTBOUND_TEST_ADDRESS?.trim();
  if (testAddress) {
    return { to: [testAddress], cc: [], subjectPrefix: `[TEST for ${[...to, ...cc].join(", ")}] ` };
  }
  if (!isLiveSite()) {
    throw new SendBlocked("Email only goes out from the live site. Set OUTBOUND_TEST_ADDRESS to try sending here.");
  }
  return { to, cc, subjectPrefix: "" };
}

const recipients = (list: string[], names?: Record<string, string>) =>
  list.map((address) => ({ emailAddress: { address, ...(names?.[address] ? { name: names[address] } : {}) } }));

/**
 * Sends from the signed-in mailbox. With `replyToGraphId` it replies in that thread (the
 * earlier message is quoted below). Draft-then-send keeps the message id stable, so the
 * sent copy can be recorded straight away and matched when Outlook syncs it back.
 */
export async function sendFromMailbox(token: string, message: OutboundMessage, replyToGraphId?: string): Promise<SentMessage> {
  const route = routeOutbound(message.to, message.cc);
  let draft: SentMessage;
  if (replyToGraphId) {
    draft = await graph<SentMessage>(token, `/me/messages/${encodeURIComponent(replyToGraphId)}/createReply`, {
      method: "POST",
      body: { message: { toRecipients: recipients(route.to, message.toNames), ccRecipients: recipients(route.cc) }, comment: message.body },
    });
    if (route.subjectPrefix) {
      await graph(token, `/me/messages/${encodeURIComponent(draft.id)}`, { method: "PATCH", body: { subject: `${route.subjectPrefix}${draft.subject ?? ""}` } });
    }
  } else {
    draft = await graph<SentMessage>(token, "/me/messages", {
      method: "POST",
      body: {
        subject: `${route.subjectPrefix}${message.subject}`,
        body: { contentType: "Text", content: message.body },
        toRecipients: recipients(route.to, message.toNames),
        ccRecipients: recipients(route.cc),
      },
    });
  }
  await graph(token, `/me/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST" });
  return draft;
}
