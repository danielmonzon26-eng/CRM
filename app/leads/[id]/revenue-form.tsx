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
      className="flex items-center gap-1"
    >
      <span className="text-xs text-slate-500">Est. revenue $</span>
      <input
        name="revenue"
        type="number"
        min={0}
        step={1000}
        defaultValue={value ?? ""}
        placeholder="unknown"
        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
