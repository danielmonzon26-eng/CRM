"use client";

import { useState, useTransition } from "react";
import { updateDealStage } from "@/app/actions/deals";
import { DEAL_STAGES, DEAL_STAGE_META } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/supabase/types";

export function DealStageSelect({ dealId, stage }: { dealId: string; stage: DealStage }) {
  const [isPending, startTransition] = useTransition();
  const [confirmingLoss, setConfirmingLoss] = useState(false);
  const [reason, setReason] = useState("");

  if (confirmingLoss) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-rose-200 bg-rose-50 p-2">
        <label className="text-[11px] font-medium text-rose-700">Reason for losing this deal</label>
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Went with a competitor, budget cut…"
          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-300"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!reason.trim() || isPending}
            onClick={() =>
              startTransition(async () => {
                await updateDealStage(dealId, "closed_lost", reason);
                setConfirmingLoss(false);
              })
            }
            className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Confirm lost
          </button>
          <button
            type="button"
            onClick={() => setConfirmingLoss(false)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      value={stage}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as DealStage;
        if (next === "closed_lost") {
          setConfirmingLoss(true);
          return;
        }
        startTransition(() => updateDealStage(dealId, next));
      }}
      className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
      onClick={(e) => e.stopPropagation()}
    >
      {DEAL_STAGES.map((s) => (
        <option key={s} value={s}>
          {DEAL_STAGE_META[s].label}
        </option>
      ))}
    </select>
  );
}
