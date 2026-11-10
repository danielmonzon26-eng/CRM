import { formatMoney } from "@/lib/budgets/money";
import type { PipelineForecast } from "@/lib/deals/queries";

/** One compact strip, so the proposals themselves stay the focus of the page. */
export function StatsBar({ forecast }: { forecast: PipelineForecast }) {
  const figures: [string, string][] = [
    ["Open proposals", forecast.openCount.toLocaleString()],
    ["Open value", formatMoney(forecast.openValue)],
    ["Weighted value", formatMoney(Math.round(forecast.weightedValue))],
    ["Accepted", `${forecast.closedWonCount.toLocaleString()} · ${formatMoney(forecast.closedWonValue)}`],
    ["Declined", forecast.closedLostCount.toLocaleString()],
  ];

  return (
    <dl className="mb-5 grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {figures.map(([label, value]) => (
        <div key={label} className="px-4 py-3">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
