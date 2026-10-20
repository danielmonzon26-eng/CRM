"use client";

import { useRef, useTransition } from "react";
import { updateCompanyRevenue } from "@/app/actions/leads";

export function RevenueForm({
  leadId,
  companyId,
  value,
}: {
  leadId: string;
  companyId: string;
  value: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const raw = String(formData.get("revenue") ?? "").trim();
        const parsed = raw === "" ? null : Number(raw);
        startTransition(() => updateCompanyRevenue(leadId, companyId, parsed !== null && Number.isFinite(parsed) ? parsed : null));
      }}
    >
      <label className="text-xs font-medium text-slate-500">Est. annual revenue</label>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            name="revenue"
            type="number"
            min={0}
            step={1000}
            defaultValue={value ?? ""}
            placeholder="unknown"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </form>
  );
}
