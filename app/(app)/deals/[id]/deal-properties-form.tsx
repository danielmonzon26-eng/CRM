"use client";

import { useTransition } from "react";
import { updateDealField } from "@/app/actions/deals";

export function DealPropertiesForm({
  dealId,
  amount,
  expectedCloseDate,
  nextStep,
  nextStepDueDate,
  competitors,
}: {
  dealId: string;
  amount: number;
  expectedCloseDate: string;
  nextStep: string | null;
  nextStepDueDate: string | null;
  competitors: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div>
        <label className="text-xs font-medium text-slate-500">Amount</label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            defaultValue={amount}
            disabled={isPending}
            onBlur={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) startTransition(() => updateDealField(dealId, "amount", parsed));
            }}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Expected close date</label>
        <input
          type="date"
          defaultValue={expectedCloseDate}
          disabled={isPending}
          onBlur={(e) => e.target.value && startTransition(() => updateDealField(dealId, "expected_close_date", e.target.value))}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Next step</label>
        <input
          type="text"
          defaultValue={nextStep ?? ""}
          placeholder="e.g. Send proposal"
          disabled={isPending}
          onBlur={(e) => startTransition(() => updateDealField(dealId, "next_step", e.target.value.trim() || null))}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Next step due</label>
        <input
          type="date"
          defaultValue={nextStepDueDate ?? ""}
          disabled={isPending}
          onBlur={(e) => startTransition(() => updateDealField(dealId, "next_step_due_date", e.target.value || null))}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Competitors</label>
        <input
          type="text"
          defaultValue={competitors ?? ""}
          placeholder="None recorded"
          disabled={isPending}
          onBlur={(e) => startTransition(() => updateDealField(dealId, "competitors", e.target.value.trim() || null))}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        />
      </div>
    </>
  );
}
