"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createDiscoveryCall } from "@/app/actions/discovery";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

/** Starts a new discovery call and opens its questionnaire. */
export function DiscoveryStartButton({ leadId, label = "Start discovery call", variant = "primary" }: { leadId: string; label?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createDiscoveryCall(leadId).catch(() => ({ error: "The discovery call wasn't started. Please try again.", callId: undefined }));
          if (result.callId) router.push(`/leads/${leadId}/discovery/${result.callId}`);
          else toast(result.error ?? "The discovery call wasn't started.", "error");
        })
      }
      className={buttonClass(variant, "sm")}
    >
      <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
      {pending ? "Starting..." : label}
    </button>
  );
}
