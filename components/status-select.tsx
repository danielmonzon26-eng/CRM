"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { updateLeadEngagement, updateLeadStatus } from "@/app/actions/leads";
import { useFeedback } from "@/components/ui/feedback";
import { ALL_ENGAGEMENTS, ALL_STATUSES, AUTOMATIC_STAGES, ENGAGEMENT_LABELS, ENGAGEMENT_STYLES, STATUS_LABELS, STATUS_STYLES } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

const SELECT =
  "w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50";
// In a table row: looks like the coloured badge, opens like a dropdown.
const INLINE =
  "cursor-pointer appearance-none rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60";

/**
 * Saves the new value straight away. Shows it immediately, and puts it back with a
 * message if saving fails.
 */
function useSavedValue<T extends string>(initial: T, save: (value: T) => Promise<{ error?: string } | void>, label: string) {
  const { toast } = useFeedback();
  const [value, setValue] = useState(initial);
  const [fromServer, setFromServer] = useState(initial);
  const [isPending, startTransition] = useTransition();
  // A refresh from the server (an automatic change, or someone else's) replaces what's shown.
  if (initial !== fromServer) {
    setFromServer(initial);
    setValue(initial);
  }
  function change(next: T) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      try {
        const result = await save(next);
        if (result?.error) {
          setValue(previous);
          toast(result.error, "error");
        }
      } catch {
        setValue(previous);
        toast(`The ${label} didn't change. Please try again.`, "error");
      }
    });
  }
  return { value, change, isPending };
}

function InlineSelect({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`relative inline-flex rounded-full ${tone}`}>
      {children}
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" strokeWidth={2.5} />
    </span>
  );
}

/** Funnel stage picker. `inline` is the compact badge for table rows. */
export function StatusSelect({ leadId, status, id, inline = false }: { leadId: string; status: LeadStatus; id?: string; inline?: boolean }) {
  const { value, change, isPending } = useSavedValue(status, (next) => updateLeadStatus(leadId, next), "stage");
  const select = (
    <select
      id={id}
      aria-label={inline ? "Stage" : undefined}
      value={value}
      disabled={isPending}
      onChange={(e) => change(e.target.value as LeadStatus)}
      className={inline ? `${INLINE} bg-transparent` : SELECT}
      onClick={(e) => e.stopPropagation()}
    >
      {ALL_STATUSES.map((s) => (
        // Proposal and Client follow proposals, so they show but can't be picked.
        <option key={s} value={s} disabled={Boolean(AUTOMATIC_STAGES[s]) && s !== value}>
          {AUTOMATIC_STAGES[s] && s !== value ? `${STATUS_LABELS[s]} (${AUTOMATIC_STAGES[s]!.toLowerCase()})` : STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
  return inline ? <InlineSelect tone={STATUS_STYLES[value]}>{select}</InlineSelect> : select;
}

/** Engaged / Not Engaged / Do Not Contact picker. `inline` is the compact badge for table rows. */
export function EngagementSelect({ leadId, engagement, id, inline = false }: { leadId: string; engagement: LeadEngagement; id?: string; inline?: boolean }) {
  const { value, change, isPending } = useSavedValue(engagement, (next) => updateLeadEngagement(leadId, next), "status");
  const select = (
    <select
      id={id}
      aria-label={inline ? "Status" : undefined}
      value={value}
      disabled={isPending}
      onChange={(e) => change(e.target.value as LeadEngagement)}
      className={inline ? `${INLINE} bg-transparent` : SELECT}
      onClick={(e) => e.stopPropagation()}
    >
      {ALL_ENGAGEMENTS.map((s) => (
        <option key={s} value={s}>
          {ENGAGEMENT_LABELS[s]}
        </option>
      ))}
    </select>
  );
  return inline ? <InlineSelect tone={ENGAGEMENT_STYLES[value]}>{select}</InlineSelect> : select;
}
