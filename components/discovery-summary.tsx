import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { DiscoveryStartButton } from "@/components/discovery-start-button";
import type { DiscoveryCall } from "@/lib/discovery/queries";
import { APEX_THRESHOLD, BLOCK_STATUS_LABELS, BMC_BLOCKS, FLAGS, blockTitle, routeFor } from "@/lib/discovery/questionnaire";

const STATUS_STYLE = {
  complete: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-900 border-amber-200",
  unknown: "bg-slate-50 text-slate-600 border-slate-200",
} as const;

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Discovery meeting notes on a lead or company page: the latest call's score and canvas, and earlier calls. */
export function DiscoverySummary({ leadId, calls }: { leadId: string; calls: DiscoveryCall[] }) {
  const latest = calls[0];
  return (
    <section id="discovery" aria-labelledby="discovery-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="discovery-title" className="text-sm font-semibold text-slate-700">
          Discovery ({calls.length})
        </h2>
        <DiscoveryStartButton leadId={leadId} label={latest ? "New discovery call" : "Start discovery call"} variant={latest ? "secondary" : "primary"} />
      </div>

      {!latest ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
          No discovery call yet. Start one to fill in the questionnaire during the call and score how much of the Business Model Canvas it covered.
        </p>
      ) : (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div>
              <p className="text-xs text-slate-500">
                {formatDay(latest.callDate)}
                {latest.prospectName ? ` · ${latest.prospectName}` : ""}
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{Math.round(latest.score)}%</span>
                <span className="text-sm text-slate-500">of the canvas covered</span>
              </p>
              <ScoreBar score={latest.score} />
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
              <RouteBadge score={latest.score} />
              {latest.score >= APEX_THRESHOLD && (
                <span className="flex items-center gap-1 text-xs font-medium text-violet-800">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} /> Apex event invite
                </span>
              )}
              {latest.recommendedEntry && <span className="text-xs text-slate-600">Entry point: <span className="font-medium text-slate-900">{latest.recommendedEntry}</span></span>}
            </div>
          </div>

          <ul aria-label="Canvas blocks" className="grid grid-cols-1 gap-1.5 border-t border-slate-100 p-4 sm:grid-cols-3">
            {BMC_BLOCKS.map((block) => {
              const status = latest.blockStatus[block] ?? "unknown";
              return (
                <li key={block} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs ${STATUS_STYLE[status]}`}>
                  <span className="truncate">{blockTitle(block)}</span>
                  <span className="shrink-0 font-medium">{BLOCK_STATUS_LABELS[status]}</span>
                </li>
              );
            })}
          </ul>

          {(latest.flags.length > 0 || latest.decisionMakerPresent === false || latest.pricingDiscussed === false || latest.consultantExperience === "bad") && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-3">
              {latest.decisionMakerPresent === false && <Flag>Decision maker absent</Flag>}
              {latest.pricingDiscussed === false && <Flag>Pricing not discussed</Flag>}
              {latest.consultantExperience === "bad" && <Flag>Bad consultant experience</Flag>}
              {latest.flags
                .filter((f) => !(f === "decision_maker_absent" && latest.decisionMakerPresent === false))
                .map((f) => (
                  <Flag key={f}>{FLAGS.find(([key]) => key === f)?.[1] ?? f}</Flag>
                ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-xs text-slate-500">Internal only. Never sent to the prospect.</span>
            <Link href={`/leads/${leadId}/discovery/${latest.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Open questionnaire
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      )}

      {calls.length > 1 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm shadow-card">
          {calls.slice(1).map((call) => (
            <li key={call.id}>
              <Link href={`/leads/${leadId}/discovery/${call.id}`} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-50">
                <span className="text-slate-700">
                  {formatDay(call.callDate)}
                  {call.prospectName ? ` · ${call.prospectName}` : ""}
                </span>
                <span className="tabular-nums text-slate-900">{Math.round(call.score)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${score}%` }} />
    </div>
  );
}

export function RouteBadge({ score }: { score: number }) {
  const route = routeFor(score);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${route.tone}`}>{route.label}</span>;
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800">
      <AlertTriangle aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
      {children}
    </span>
  );
}
