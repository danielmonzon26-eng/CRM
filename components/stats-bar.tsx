import { Users, Sparkles, Award, Trophy, DollarSign, TrendingUp } from "lucide-react";
import type { PipelineStats } from "@/lib/leads/queries";
import type { PipelineForecast } from "@/lib/deals/queries";

export function StatsBar({ stats, forecast }: { stats: PipelineStats; forecast: PipelineForecast }) {
  const tiles = [
    { label: "Total leads", value: stats.total.toLocaleString(), icon: Users, accent: "text-slate-500 bg-slate-100" },
    { label: "New this week", value: stats.newThisWeek.toLocaleString(), icon: Sparkles, accent: "text-brand-600 bg-brand-50" },
    { label: "Qualified", value: stats.byStatus.qualified.toLocaleString(), icon: Award, accent: "text-amber-600 bg-amber-50" },
    {
      label: "Open pipeline value",
      value: `$${forecast.openValue.toLocaleString()}`,
      icon: DollarSign,
      accent: "text-sky-600 bg-sky-50",
    },
    {
      label: "Weighted pipeline",
      value: `$${Math.round(forecast.weightedValue).toLocaleString()}`,
      icon: TrendingUp,
      accent: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Closed-won revenue",
      value: `$${forecast.closedWonValue.toLocaleString()}`,
      icon: Trophy,
      accent: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
  );
}
