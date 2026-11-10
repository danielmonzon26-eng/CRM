"use client";

import { ALL_ENGAGEMENTS, ALL_STATUSES, ENGAGEMENT_LABELS, STATUS_DOTS, STATUS_LABELS } from "@/lib/leads/filters";
import type { EngagementSummary, StageSummary } from "@/lib/leads/search";
import type { LeadEngagement } from "@/lib/supabase/types";

const ENGAGEMENT_DOTS: Record<LeadEngagement, string> = {
  engaged: "bg-emerald-500",
  not_engaged: "bg-slate-400",
  do_not_contact: "bg-rose-500",
};

/**
 * Totals by status and by stage. Clicking a tile filters the list to it, and clicking the
 * active tile clears that filter. Each row's totals respect every other filter.
 */
export function LeadsDashboard({
  stages,
  engagements,
  activeStage,
  activeEngagement,
  onStage,
  onEngagement,
}: {
  stages: StageSummary[];
  engagements: EngagementSummary[];
  activeStage: string;
  /** "" means Engaged (the default), "all" means every status. */
  activeEngagement: string;
  onStage: (stage: string) => void;
  onEngagement: (engagement: string) => void;
}) {
  const current = activeEngagement || "engaged";
  const allStatuses = engagements.reduce((total, e) => total + e.count, 0);
  const stageTotal = stages.reduce((total, s) => total + s.count, 0);
  const maxStage = Math.max(1, ...stages.map((s) => s.count));
  const statusLabel = current === "all" ? "all statuses" : ENGAGEMENT_LABELS[current as LeadEngagement].toLowerCase();

  return (
    <section aria-label="Lead totals" className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</h2>
        <span className="text-xs text-slate-500">Click to filter</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ALL_ENGAGEMENTS.map((engagement) => {
          const count = engagements.find((e) => e.engagement === engagement)?.count ?? 0;
          const active = current === engagement;
          return (
            <Tile
              key={engagement}
              active={active}
              onClick={() => onEngagement(engagement === "engaged" ? "" : active ? "" : engagement)}
              label={ENGAGEMENT_LABELS[engagement]}
              count={count}
              dot={ENGAGEMENT_DOTS[engagement]}
            />
          );
        })}
        <Tile active={current === "all"} onClick={() => onEngagement(current === "all" ? "" : "all")} label="All statuses" count={allStatuses} dot="bg-ink-900" />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage</h2>
        <span className="text-xs text-slate-500">
          {stageTotal.toLocaleString()} {statusLabel}
          {activeStage && (
            <>
              {" · "}
              <button type="button" onClick={() => onStage("")} className="font-medium text-brand-700 hover:underline">
                Show all stages
              </button>
            </>
          )}
        </span>
      </div>
      <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {ALL_STATUSES.map((stage, i) => {
          const count = stages.find((s) => s.status === stage)?.count ?? 0;
          const active = activeStage === stage;
          return (
            <li key={stage}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onStage(active ? "" : stage)}
                className={`flex h-full w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                  active ? "border-brand-600 bg-brand-50" : activeStage ? "border-slate-200 bg-white opacity-60 hover:opacity-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className="tabular-nums text-slate-400">{i + 1}</span>
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOTS[stage]}`} />
                  <span className="truncate">{STATUS_LABELS[stage]}</span>
                </span>
                <span className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{count.toLocaleString()}</span>
                <span aria-hidden="true" className="mt-1.5 block h-1 w-full rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${STATUS_DOTS[stage]}`} style={{ width: `${(count / maxStage) * 100}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Tile({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        active ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-700">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-xl font-semibold tabular-nums text-slate-900">{count.toLocaleString()}</span>
    </button>
  );
}
