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
    <>
      <div>
        <label className="text-xs font-medium text-slate-500">Deal value</label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            defaultValue={dealValue ?? ""}
            placeholder="0"
            disabled={isPending}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const parsed = raw === "" ? null : Number(raw);
              startTransition(() => updateDealValue(leadId, parsed !== null && Number.isFinite(parsed) ? parsed : null));
            }}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Expected close date</label>
        <input
          type="date"
          defaultValue={expectedCloseDate ?? ""}
          disabled={isPending}
          onBlur={(e) => startTransition(() => updateExpectedCloseDate(leadId, e.target.value || null))}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        />
      </div>
    </>
  );
}
