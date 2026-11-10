import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { isOutlookConfigured } from "@/lib/outlook/graph";
import { getEmailsForAddresses, getMailAccounts, getMeetingsForAddresses } from "@/lib/outlook/queries";
import { ComposeEmailButton } from "./compose-email";
import { EmailList } from "./email-list";
import { MailAutoSync } from "./mail-sync";
import { MeetingList } from "./meeting-list";

/** "Email & meetings" for a lead or company page, matched on its contacts' addresses. */
export async function RecordCommunication({
  contactEmails,
  leadId,
  emailTo,
  blockedReason,
}: {
  contactEmails: string[];
  leadId?: string;
  /** Disables sending, e.g. when the company is Do Not Contact. */
  blockedReason?: string;
  /** Prefilled recipient for the compose button, usually the primary contact. */
  emailTo?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, emails, meetings] = await Promise.all([
    getMailAccounts(),
    getEmailsForAddresses(contactEmails, user.id),
    getMeetingsForAddresses(contactEmails),
  ]);
  const mine = accounts.find((a) => a.userId === user.id);
  const canSend = isOutlookConfigured() && mine?.status === "connected";

  return (
    <section>
      {accounts.length > 0 && <MailAutoSync />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Email & meetings</h2>
        <ComposeEmailButton canSend={canSend} blockedReason={blockedReason} size="sm" label="New email" defaults={{ to: emailTo ?? "", leadId }} />
      </div>

      {!mine && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Link href="/communication" className="font-medium text-brand-700 hover:underline">
            Connect your Outlook
          </Link>{" "}
          to send email from here{accounts.length === 0 ? " and see past conversations" : ""}.
        </p>
      )}

      {contactEmails.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Add an email address to a contact to see their emails and meetings here.</p>
      ) : (
        <div className="mt-2 space-y-4">
          <EmailList emails={emails} canSend={canSend} blockedReason={blockedReason} leadId={leadId} showMailbox={accounts.length > 1} emptyText="No email with these contacts yet." />
          {meetings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meetings</h3>
              <div className="mt-2">
                <MeetingList meetings={meetings} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
