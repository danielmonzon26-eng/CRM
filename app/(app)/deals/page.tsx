import { DollarSign, Target, TrendingUp, Trophy, XCircle } from "lucide-react";
import { getDealsBoard, getPipelineForecast } from "@/lib/deals/queries";
import { DealCard } from "@/components/deal-card";
import { DEAL_STAGES, DEAL_STAGE_META } from "@/lib/deals/stages";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, forecast] = await Promise.all([getDealsBoard(), getPipelineForecast()]);

  const tiles = [
    { label: "Open deals", value: forecast.openCount.toLocaleString(), icon: Target, accent: "text-brand-600 bg-brand-50" },
    { label: "Pipeline value", value: `$${forecast.openValue.toLocaleString()}`, icon: DollarSign, accent: "text-slate-500 bg-slate-100" },
    {
      label: "Weighted value",
      value: `$${Math.round(forecast.weightedValue).toLocaleString()}`,
      icon: TrendingUp,
      accent: "text-sky-600 bg-sky-50",
    },
    {
      label: "Closed won",
      value: `${forecast.closedWonCount} · $${forecast.closedWonValue.toLocaleString()}`,
      icon: Trophy,
      accent: "text-emerald-600 bg-emerald-50",
    },
    { label: "Closed lost", value: forecast.closedLostCount.toLocaleString(), icon: XCircle, accent: "text-rose-600 bg-rose-50" },
  ];

  return (
    <main className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500">Track and manage your sales opportunities.</p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card">
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tile.accent}`}>
                <tile.icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-xl font-semibold tracking-tight text-slate-900">{tile.value}</p>
              <p className="text-xs text-slate-500">{tile.label}</p>
            </div>
          ))}
        </div>

        {deals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500">
              No deals yet. Open a qualified lead or company record and click "Create deal" to track a revenue
              opportunity.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + d.amount, 0);
              const meta = DEAL_STAGE_META[stage];
              return (
                <div key={stage} className="flex w-72 shrink-0 flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${meta.accent}`} />
                      {meta.label}
                    </h2>
                    <span className="text-xs text-slate-400">${stageValue.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stageDeals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} />
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                        No deals
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
