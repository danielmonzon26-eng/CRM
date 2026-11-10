"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { disconnectOutlook } from "@/app/actions/outlook";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { MailAccount } from "@/lib/outlook/queries";

/** The signed-in user's Outlook connection, plus everyone else's connected mailboxes. */
export function MailboxPanel({
  accounts,
  currentUserId,
  configured,
}: {
  accounts: MailAccount[];
  currentUserId: string;
  configured: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const mine = accounts.find((a) => a.userId === currentUserId);
  const others = accounts.filter((a) => a.userId !== currentUserId);

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect your Outlook?",
      body: "The CRM stops syncing your mailbox, and the email and meetings it copied from it are removed from the CRM. Nothing is deleted from Outlook.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await disconnectOutlook().catch(() => ({ error: "Outlook wasn't disconnected. Please try again." }));
      if (result.error) toast(result.error, "error");
      else {
        toast("Outlook disconnected.");
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="mailboxes-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 id="mailboxes-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Your Outlook
      </h2>

      {!configured ? (
        <p className="mt-2 text-sm text-slate-600">
          Outlook isn&apos;t set up on this site yet. An admin needs to add the Microsoft app settings (see docs/OUTLOOK_EMAIL.md).
        </p>
      ) : mine ? (
        <div className="mt-2 space-y-2">
          <p className="flex items-start gap-2 text-sm text-slate-900">
            {mine.status === "connected" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
            )}
            <span className="min-w-0 break-all">{mine.email}</span>
          </p>
          <p className="text-xs text-slate-600">
            {mine.status !== "connected"
              ? "Microsoft asked for you to sign in again."
              : mine.lastSyncedLabel
                ? `Last synced ${mine.lastSyncedLabel}`
                : "First sync in progress. This can take a minute."}
          </p>
          {mine.lastError && mine.status === "connected" && (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Last sync had a problem: {mine.lastError}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {mine.status !== "connected" && (
              <a href="/api/outlook/connect" className={buttonClass("primary", "sm")}>
                Reconnect Outlook
              </a>
            )}
            <button type="button" disabled={pending} onClick={disconnect} className={buttonClass("ghost", "sm")}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-slate-600">
            Connect your Microsoft 365 mailbox to see email and meetings with your contacts, and send email from the CRM.
          </p>
          <a href="/api/outlook/connect" className={`${buttonClass("primary")} mt-3`}>
            <Mail className="h-4 w-4" strokeWidth={2} />
            Connect Outlook
          </a>
          <p className="mt-2 text-xs text-slate-500">
            Only email and meetings with people saved as contacts are copied into the CRM. Everyone on the team can see them.
          </p>
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team mailboxes</h3>
          <ul className="mt-2 space-y-1">
            {others.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">{a.displayName ?? a.email}</span>
                {a.status !== "connected" && <span className="shrink-0 text-xs text-amber-700">Needs reconnect</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
