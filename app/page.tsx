import { LeadCard } from "@/components/lead-card";
import { StatsBar } from "@/components/stats-bar";
import { getLeadsBoard, getPipelineStats } from "@/lib/leads/queries";
import type { LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const COLUMNS: { status: LeadStatus; label: string; accent: string }[] = [
  { status: "new", label: "New", accent: "bg-slate-400" },
  { status: "researching", label: "Researching", accent: "bg-sky-500" },
  { status: "contacted", label: "Contacted", accent: "bg-indigo-500" },
  { status: "qualified", label: "Qualified", accent: "bg-amber-500" },
  { status: "won", label: "Won", accent: "bg-emerald-500" },
  { status: "lost", label: "Lost", accent: "bg-rose-400" },
  { status: "unqualified", label: "Unqualified", accent: "bg-slate-300" },
];

export default async function Home() {
  const [leads, stats] = await Promise.all([getLeadsBoard(), getPipelineStats()]);

  return (
    <main className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"} in the pipeline
          </p>
        </header>

        <StatsBar stats={stats} />

        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500">
              No leads yet. Run the ingestion and scoring crons (see README) to populate the pipeline.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              const columnLeads = leads.filter((l) => l.status === col.status);
              return (
                <div key={col.status} className="flex w-72 shrink-0 flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                      {col.label}
                    </h2>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {columnLeads.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {columnLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                    {columnLeads.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                        No leads
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
