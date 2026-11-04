import type { PipelineForecast } from "@/lib/deals/queries";
import { formatMoney } from "@/lib/budgets/money";
import type { PipelineStats } from "@/lib/leads/queries";

/** One compact strip, so the pipeline itself stays the focus of the page. */
export function StatsBar({ stats, forecast }: { stats: PipelineStats; forecast: PipelineForecast }) {
  const figures: [string, string][] = [
    ["Total leads", stats.total.toLocaleString()],
    ["New this week", stats.newThisWeek.toLocaleString()],
    ["Qualified", stats.byStatus.qualified.toLocaleString()],
    ["Open pipeline", formatMoney(forecast.openValue)],
    ["Weighted pipeline", formatMoney(Math.round(forecast.weightedValue))],
    ["Closed-won revenue", formatMoney(forecast.closedWonValue)],
  ];

  return (
    <dl className="mb-5 grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-card sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
      {figures.map(([label, value]) => (
        <div key={label} className="px-4 py-3">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
