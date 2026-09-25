import type { PipelineStats } from "@/lib/leads/queries";

export function StatsBar({ stats }: { stats: PipelineStats }) {
  const tiles = [
    { label: "Total leads", value: stats.total },
    { label: "New this week", value: stats.newThisWeek },
    { label: "Contacted", value: stats.byStatus.contacted },
    { label: "Qualified", value: stats.byStatus.qualified },
    { label: "Won", value: stats.byStatus.won },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-slate-900">{tile.value}</p>
          <p className="text-xs text-slate-500">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
