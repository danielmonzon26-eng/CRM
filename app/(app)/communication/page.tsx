import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { ComposeEmailButton } from "@/components/outlook/compose-email";
import { EmailList } from "@/components/outlook/email-list";
import { MailboxPanel } from "@/components/outlook/mailbox-panel";
import { MailAutoSync, SyncNowButton } from "@/components/outlook/mail-sync";
import { MeetingList } from "@/components/outlook/meeting-list";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth/session";
import { isOutlookConfigured } from "@/lib/outlook/graph";
import { getInbox, getMailAccounts, getUpcomingMeetings, type InboxFilter } from "@/lib/outlook/queries";

export const dynamic = "force-dynamic";

const TABS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "unread", label: "Unread" },
];

const NOTICES: Record<string, { tone: "good" | "bad"; text: string }> = {
  connected: { tone: "good", text: "Outlook connected. Your email and meetings with contacts are being added now." },
  declined: { tone: "bad", text: "Outlook wasn't connected because access was declined in Microsoft." },
  in_use: { tone: "bad", text: "That mailbox is already connected by someone else on the team." },
  not_configured: { tone: "bad", text: "Outlook isn't set up on this site yet." },
  failed: { tone: "bad", text: "Outlook couldn't be connected. Please try again." },
};

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; outlook?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { filter, outlook } = await searchParams;
  const activeFilter = (TABS.some((t) => t.value === filter) ? filter : "all") as InboxFilter;
  const configured = isOutlookConfigured();
  const [accounts, emails, meetings] = await Promise.all([
    getMailAccounts(),
    getInbox(user.id, activeFilter),
    getUpcomingMeetings(),
  ]);
  const mine = accounts.find((a) => a.userId === user.id);
  const canSend = configured && mine?.status === "connected";
  const notice = outlook ? NOTICES[outlook] : undefined;

  return (
    <Page>
      {accounts.length > 0 && <MailAutoSync />}
      <PageHeader
        title="Communication"
        subtitle="Email and meetings with your leads and contacts, from Outlook."
        actions={
          <>
            {accounts.length > 0 && configured && <SyncNowButton />}
            <ComposeEmailButton canSend={canSend} variant="primary" label="New email" defaults={{}} />
          </>
        }
      />

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "good" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <nav aria-label="Filter email" className="mb-4 flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/communication?filter=${tab.value}`}
                aria-current={activeFilter === tab.value ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  activeFilter === tab.value
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {accounts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No mailboxes connected yet"
              description="Connect Outlook to see email with your leads and contacts here, and to send email from the CRM."
            />
          ) : (
            <EmailList
              emails={emails}
              canSend={canSend}
              showMailbox={accounts.length > 1}
              emptyText={
                activeFilter === "all"
                  ? "No email with your contacts yet. New messages show up here after the next sync."
                  : activeFilter === "unread"
                    ? "No unread email from contacts."
                    : "Nothing waiting on a reply."
              }
            />
          )}
        </div>

        <aside className="space-y-4">
          <MailboxPanel accounts={accounts} currentUserId={user.id} configured={configured} />
          <section aria-labelledby="meetings-title">
            <h2 id="meetings-title" className="text-sm font-semibold text-slate-700">
              Upcoming meetings
            </h2>
            <div className="mt-2">
              <MeetingList meetings={meetings} emptyText="No upcoming meetings with contacts." />
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}
