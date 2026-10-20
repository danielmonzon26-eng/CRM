"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/app/actions/leads";
import type { LeadStatus } from "@/lib/supabase/types";

const STATUSES: LeadStatus[] = ["new", "researching", "contacted", "qualified", "won", "lost", "unqualified"];

export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateLeadStatus(leadId, e.target.value as LeadStatus))}
      className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium capitalize text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
      onClick={(e) => e.stopPropagation()}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
