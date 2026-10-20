import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2 } from "lucide-react";
import { getDealDetail, getDealStageHistory } from "@/lib/deals/queries";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import { DealStageSelect } from "@/components/deal-stage-select";
import { getInitials } from "@/lib/text";
import { DealPropertiesForm } from "./deal-properties-form";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, history] = await Promise.all([getDealDetail(id), getDealStageHistory(id)]);
  if (!deal) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/deals" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to deals
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(deal.companyName) || <Building2 className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{deal.name}</h1>
            <p className="text-sm text-slate-500">
              <Link href={`/companies/${deal.companyId}`} className="hover:text-brand-700 hover:underline">
                {deal.companyName}
              </Link>
              {" · "}${deal.amount.toLocaleString()} {deal.currency} · {deal.probability}% probability
            </p>
          </div>
        </div>
        {deal.leadId && (
          <Link
            href={`/leads/${deal.leadId}`}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Lead record
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        )}
      </div>

      {deal.stage === "closed_lost" && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-medium">Closed lost.</span> {deal.lostReason ?? "No reason recorded."}
        </div>
      )}
      {deal.stage === "closed_won" && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-medium">Closed won</span>
          {deal.closedAt ? ` on ${new Date(deal.closedAt).toLocaleDateString()}` : ""}.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-slate-700">Stage history</h2>
            <ul className="mt-2 space-y-3 border-l border-slate-200 pl-4">
              {history.length === 0 && <p className="text-sm text-slate-400">No stage changes recorded.</p>}
              {history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
                  <span className="font-medium text-slate-700">
                    {h.fromStage ? `${DEAL_STAGE_META[h.fromStage].label} → ` : "Created at "}
                    {DEAL_STAGE_META[h.toStage].label}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{new Date(h.changedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deal properties</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Stage</label>
                <div className="mt-1">
                  <DealStageSelect dealId={deal.id} stage={deal.stage} />
                </div>
              </div>
              <DealPropertiesForm
                dealId={deal.id}
                amount={deal.amount}
                expectedCloseDate={deal.expectedCloseDate}
                nextStep={deal.nextStep}
                nextStepDueDate={deal.nextStepDueDate}
                competitors={deal.competitors}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
