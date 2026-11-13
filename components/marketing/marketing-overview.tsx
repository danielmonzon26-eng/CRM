import Link from "next/link";
import { AlertTriangle, CalendarClock, Play } from "lucide-react";
import { BarRow, money, Panel, PanelEmpty } from "@/components/ui/dashboard";
import type { DashboardEntry, MarketingDashboard } from "@/lib/marketing/dashboard";

const TONE: Record<DashboardEntry["tone"], string> = {
  rose: "bg-rose-50 text-rose-800",
  amber: "bg-amber-50 text-amber-900",
  emerald: "bg-emerald-50 text-emerald-800",
  sky: "bg-sky-50 text-sky-800",
  slate: "bg-slate-100 text-slate-700",
};

const TYPE_BAR: Record<string, string> = { social: "bg-sky-500", online_advertising: "bg-violet-500", production: "bg-teal-500", creative: "bg-fuchsia-500", event_materials: "bg-orange-500", onsite_advertising: "bg-indigo-500", newsletter: "bg-lime-500" };

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const STREAM_HEX: Record<string, string> = { catapult: "#ff6729", event: "#0ea5e9", sponsorship: "#f59e0b" };

/**
 * The money at the top of the page: the budget's total from the Budgets report, how much of it
 * marketing has allocated (split by stream), what's spent, and what's left to allocate.
 */
function BudgetSummary({ b }: { b: MarketingDashboard["budget"] }) {
  const over = b.remaining < 0;
  const scale = Math.max(b.total, b.allocated, 1);
  const allocatedPct = pct(b.allocated, b.total);
  const figures = [
    { label: "Allocated to marketing", value: money(b.allocated), detail: b.total ? `${allocatedPct}% of the budget` : "Add items with a budget line" },
    { label: "Spent to date", value: money(b.spent), detail: b.allocated ? `${pct(b.spent, b.allocated)}% of what's allocated` : "Recorded under Budgets" },
    {
      label: over ? "Over-allocated" : "Left to allocate",
      value: money(Math.abs(b.remaining)),
      detail: b.total ? `${pct(Math.max(b.remaining, 0), b.total)}% of the budget` : "—",
      tone: over ? "text-rose-700" : "text-emerald-700",
    },
    { label: "Marketing items", value: String(b.items.planned + b.items.inProgress + b.items.done), detail: `${b.items.planned} planned · ${b.items.inProgress} in progress · ${b.items.done} done` },
  ];
  return (
    <section aria-labelledby="mk-budget-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-6 bg-gradient-to-br from-slate-50 to-white px-6 py-6">
        <div>
          <h2 id="mk-budget-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Marketing budget
          </h2>
          <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-slate-900">{money(b.total)}</p>
          <p className="mt-1.5 text-sm text-slate-500">
            {b.name ? (
              <>
                From{" "}
                <Link href="/budgets" className="font-medium text-brand-700 hover:underline">
                  {b.name}
                </Link>
                {b.totalSet ? "" : " · lines added up. Set the Total budget on the Budgets page to fix it."}
              </>
            ) : (
              <Link href="/budgets" className="font-medium text-brand-700 hover:underline">
                Set up a budget
              </Link>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold tabular-nums tracking-tight ${over ? "text-rose-700" : "text-slate-900"}`}>{allocatedPct}%</p>
          <p className="text-sm text-slate-500">allocated</p>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div
          className={`flex h-4 overflow-hidden rounded-full ${over ? "bg-rose-100" : "bg-slate-100"}`}
          role="img"
          aria-label={`${allocatedPct}% of the ${money(b.total)} budget is allocated to marketing${over ? `, over by ${money(-b.remaining)}` : ""}`}
        >
          {b.byStream
            .filter((s) => s.amount > 0)
            .map((s) => (
              <span
                key={s.key}
                title={`${s.label}: ${money(s.amount)}`}
                className="h-full border-r-2 border-white transition-[width] duration-500 last:border-r-0"
                style={{ width: `${(s.amount / scale) * 100}%`, backgroundColor: over ? "#e11d48" : STREAM_HEX[s.key] }}
              />
            ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {b.byStream.map((s) => (
            <li key={s.key}>
              <Link href={`/marketing/${s.key}`} className="inline-flex items-center gap-2 hover:underline">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STREAM_HEX[s.key] }} />
                <span className="text-slate-600">{s.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">{money(s.amount)}</span>
              </Link>
            </li>
          ))}
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
            <span className="text-slate-600">{over ? "Over by" : "Unallocated"}</span>
            <span className={`font-semibold tabular-nums ${over ? "text-rose-700" : "text-slate-900"}`}>{money(Math.abs(b.remaining))}</span>
          </li>
        </ul>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 lg:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className="rounded-xl bg-slate-50/80 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</dt>
              <dd className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${f.tone ?? "text-slate-900"}`}>{f.value}</dd>
              <dd className="mt-0.5 text-xs text-slate-500">{f.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** The Marketing landing page: the money, then what needs attention, what's running, and what's coming up. */
export function MarketingOverview({ d }: { d: MarketingDashboard }) {
  const b = d.budget;
  return (
    <div className="space-y-5">
      <BudgetSummary b={b} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <EntryPanel title="Needs attention" count={d.counts.attention} icon={AlertTriangle} empty="Nothing needs attention." entries={d.attention} accent="text-rose-700" />
        <EntryPanel title="Running now" count={d.counts.running} icon={Play} empty="Nothing in progress right now." entries={d.running} accent="text-sky-700" />
        <EntryPanel title="Upcoming" subtitle="Next 30 days" count={d.counts.upcoming} icon={CalendarClock} empty="Nothing due in the next 30 days." entries={d.upcoming} accent="text-slate-700" href="/marketing/planner" />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Panel title="Allocated by item" subtitle="By kind of marketing item">
          <div className="space-y-0.5 p-3">
            {b.byType.map((t) => (
              <BarRow
                key={t.key}
                label={`${t.label} · ${t.count} ${t.count === 1 ? "item" : "items"}`}
                value={t.amount}
                max={Math.max(...b.byType.map((x) => x.amount), 1)}
                valueLabel={money(t.amount)}
                barClass={TYPE_BAR[t.key]}
              />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EntryPanel({
  title,
  subtitle,
  count,
  icon: Icon,
  empty,
  entries,
  accent,
  href,
}: {
  title: string;
  subtitle?: string;
  count: number;
  icon: typeof AlertTriangle;
  empty: string;
  entries: DashboardEntry[];
  accent: string;
  href?: string;
}) {
  return (
    <Panel title={`${title} (${count})`} subtitle={subtitle} href={href} linkLabel="Planner">
      {entries.length === 0 ? (
        <PanelEmpty icon={Icon}>{empty}</PanelEmpty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.key}>
              <Link href={e.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} strokeWidth={2} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{e.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {e.detail}
                    {e.dayLabel ? ` · ${e.dayLabel}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[e.tone]}`}>{e.tag}</span>
                  {e.amount ? <span className="text-xs tabular-nums text-slate-600">{money(e.amount)}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
