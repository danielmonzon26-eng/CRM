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
      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs capitalize text-slate-700 disabled:opacity-50"
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
