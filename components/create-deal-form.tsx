"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createDeal } from "@/app/actions/deals";

export function CreateDealForm({
  companyId,
  leadId,
  primaryContactId,
  defaultName,
}: {
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Create deal
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const amount = Number(data.get("amount"));
        const expectedCloseDate = String(data.get("expectedCloseDate") ?? "");
        if (!amount || !expectedCloseDate) return;

        startTransition(async () => {
          const dealId = await createDeal({
            name: String(data.get("name") ?? defaultName).trim() || defaultName,
            companyId,
            leadId,
            primaryContactId,
            amount,
            expectedCloseDate,
          });
          router.push(`/deals/${dealId}`);
        });
      }}
    >
      <input
        name="name"
        defaultValue={defaultName}
        required
        placeholder="Deal name"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            name="amount"
            type="number"
            min={0}
            step={1000}
            required
            placeholder="Amount"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
          />
        </div>
        <input
          name="expectedCloseDate"
          type="date"
          required
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create deal"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
