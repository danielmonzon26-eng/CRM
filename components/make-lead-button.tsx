"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { makeLead } from "@/app/actions/leads";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

/** Turns a company into a lead, then opens the lead unless `stayOnPage`. */
export function MakeLeadButton({
  companyId,
  companyName,
  size = "md",
  variant = "primary",
  stayOnPage = false,
}: {
  companyId: string;
  companyName: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
  stayOnPage?: boolean;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Make ${companyName} a lead`}
      onClick={() =>
        startTransition(async () => {
          const result = await makeLead(companyId).catch(() => ({ error: "The lead wasn't made. Please try again.", leadId: undefined }));
          if (result.error || !result.leadId) {
            toast(result.error ?? "The lead wasn't made. Please try again.", "error");
            return;
          }
          toast(`${companyName} is now a lead.`);
          if (stayOnPage) router.refresh();
          else router.push(`/leads/${result.leadId}`);
        })
      }
      className={buttonClass(variant, size)}
    >
      <Plus className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
      {pending ? "Making lead..." : "Make lead"}
    </button>
  );
}
