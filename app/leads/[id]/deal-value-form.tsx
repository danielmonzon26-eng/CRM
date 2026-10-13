"use client";

import { useTransition } from "react";
import { updateDealValue, updateExpectedCloseDate } from "@/app/actions/leads";

export function DealValueForm({
  leadId,
  dealValue,
  expectedCloseDate,
}: {
  leadId: string;
  dealValue: number | null;
  expectedCloseDate: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Deal value $</span>
        <input
          type="number"
          min={0}
          step={1000}
          defaultValue={dealValue ?? ""}
          placeholder="—"
          disabled={isPending}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const parsed = raw === "" ? null : Number(raw);
            startTransition(() => updateDealValue(leadId, parsed !== null && Number.isFinite(parsed) ? parsed : null));
          }}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Close</span>
        <input
          type="date"
          defaultValue={expectedCloseDate ?? ""}
          disabled={isPending}
          onBlur={(e) => startTransition(() => updateExpectedCloseDate(leadId, e.target.value || null))}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        />
      </div>
    </div>
  );
}
