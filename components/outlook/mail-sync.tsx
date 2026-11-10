"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncMail } from "@/app/actions/outlook";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

/**
 * Checks Outlook for new mail when the page opens, then refreshes the page if anything
 * changed. The server skips mailboxes synced in the last few minutes.
 */
export function MailAutoSync() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    syncMail(false)
      .then((result) => {
        if (active && result.changed) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);
  return null;
}

export function SyncNowButton() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [syncing, startSync] = useTransition();
  return (
    <button
      type="button"
      disabled={syncing}
      onClick={() =>
        startSync(async () => {
          try {
            const result = await syncMail(true);
            if (result.error) toast(`Sync had a problem. ${result.error}`, "error");
            else toast(result.changed ? "New email and meetings added." : "Everything is up to date.");
            router.refresh();
          } catch {
            toast("Sync didn't finish. Please try again.", "error");
          }
        })
      }
      className={buttonClass("secondary")}
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={2} />
      {syncing ? "Syncing..." : "Sync now"}
    </button>
  );
}
