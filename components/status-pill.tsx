import { ENGAGEMENT_LABELS, ENGAGEMENT_STYLES, STATUS_DOTS, STATUS_LABELS, STATUS_STYLES } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

/** A lead's funnel stage. */
export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Engaged, Not Engaged, or Do Not Contact. */
export function EngagementPill({ engagement }: { engagement: LeadEngagement }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ENGAGEMENT_STYLES[engagement]}`}>
      {ENGAGEMENT_LABELS[engagement]}
    </span>
  );
}
