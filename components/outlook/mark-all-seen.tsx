"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markAllEmailsSeen } from "@/app/actions/outlook";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

/** Clears the new-email count on the Communication tab without opening each one. */
export function MarkAllSeenButton({ count }: { count: number }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllEmailsSeen().catch(() => ({ error: "Couldn't clear the new emails. Please try again." }));
          if (result.error) toast(result.error, "error");
          else {
            toast("All caught up.");
            router.refresh();
          }
        })
      }
      className={buttonClass("secondary")}
    >
      <CheckCheck className="h-4 w-4" strokeWidth={2} />
      {pending ? "Clearing..." : `Mark ${count} as seen`}
    </button>
  );
}
