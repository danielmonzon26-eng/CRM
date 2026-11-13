"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDealStage, type DeclineDetails } from "@/app/actions/deals";
import { DeclineDialog } from "@/components/decline-dialog";
import { useFeedback } from "@/components/ui/feedback";
import { DEAL_STAGES, DEAL_STAGE_META } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/supabase/types";

/** The four proposal stages as one row of buttons, so the current one is obvious. */
export function DealStageSelect({ dealId, stage, proposalName }: { dealId: string; stage: DealStage; proposalName: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);

  function move(s: DealStage, decline?: DeclineDetails) {
    startTransition(async () => {
      try {
        await updateDealStage(dealId, s, decline);
        toast(`Moved to ${DEAL_STAGE_META[s].label}`);
        router.refresh();
      } catch {
        toast("The stage didn't change. Please try again.", "error");
      }
    });
  }

  return (
    <div role="radiogroup" aria-label="Proposal stage" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {DEAL_STAGES.map((s) => {
        const active = s === stage;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isPending}
            onClick={() => {
              if (active) return;
              if (s === "declined") setDeclining(true);
              else move(s);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              active ? `border-current ${DEAL_STAGE_META[s].pill}` : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DEAL_STAGE_META[s].accent}`} />
            {DEAL_STAGE_META[s].short}
          </button>
        );
      })}
      {declining && (
        <DeclineDialog
          proposalName={proposalName}
          onCancel={() => setDeclining(false)}
          onConfirm={(details) => {
            setDeclining(false);
            move("declined", details);
          }}
        />
      )}
    </div>
  );
}
