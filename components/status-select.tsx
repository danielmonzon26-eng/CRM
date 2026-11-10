"use client";

import { useTransition } from "react";
import { updateLeadEngagement, updateLeadStatus } from "@/app/actions/leads";
import { ALL_ENGAGEMENTS, ALL_STATUSES, ENGAGEMENT_LABELS, STATUS_LABELS } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

const SELECT =
  "w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50";

/** Funnel stage picker. */
export function StatusSelect({ leadId, status, id }: { leadId: string; status: LeadStatus; id?: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      id={id}
      value={status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateLeadStatus(leadId, e.target.value as LeadStatus))}
      className={SELECT}
      onClick={(e) => e.stopPropagation()}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

/** Engaged / Not Engaged / Not Qualified / Do Not Contact picker. */
export function EngagementSelect({ leadId, engagement, id }: { leadId: string; engagement: LeadEngagement; id?: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      id={id}
      value={engagement}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateLeadEngagement(leadId, e.target.value as LeadEngagement))}
      className={SELECT}
    >
      {ALL_ENGAGEMENTS.map((s) => (
        <option key={s} value={s}>
          {ENGAGEMENT_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
