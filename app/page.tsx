import { LeadCard } from "@/components/lead-card";
import { getLeadsBoard } from "@/lib/leads/queries";
import type { LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "researching", label: "Researching" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "won", label: "Won" },
  { status: "lost", label: "Lost" },
  { status: "unqualified", label: "Unqualified" },
];

export default async function Home() {
  const leads = await getLeadsBoard();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Calgary Lead Engine</h1>
          <p className="text-sm text-slate-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"} in the pipeline
          </p>
        </header>

        {leads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
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
                    <h2 className="text-sm font-medium text-slate-700">{col.label}</h2>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {columnLeads.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {columnLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                    {columnLeads.length === 0 && (
                      <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
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
