import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, PiggyBank, Play, Receipt, Wallet } from "lucide-react";
import { BarRow, Kpi, money, Panel, PanelEmpty } from "@/components/ui/dashboard";
import type { DashboardEntry, MarketingDashboard } from "@/lib/marketing/dashboard";

const TONE: Record<DashboardEntry["tone"], string> = {
  rose: "bg-rose-50 text-rose-800",
  amber: "bg-amber-50 text-amber-900",
  emerald: "bg-emerald-50 text-emerald-800",
  sky: "bg-sky-50 text-sky-800",
  slate: "bg-slate-100 text-slate-700",
};

const STREAM_BAR: Record<string, string> = { catapult: "bg-brand-500", event: "bg-sky-500", sponsorship: "bg-amber-500" };
const TYPE_BAR: Record<string, string> = { social: "bg-sky-500", online_advertising: "bg-violet-500", production: "bg-teal-500", creative: "bg-fuchsia-500" };

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The Marketing landing page: the money, then what needs attention, what's running, and what's coming up. */
export function MarketingOverview({ d }: { d: MarketingDashboard }) {
  const b = d.budget;
  return (
    <div className="space-y-5">
      <section aria-label="Budget" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Wallet} tone="bg-slate-100 text-slate-700" value={money(b.total)} label="Total budget" detail={b.name ?? "No budget yet"} href="/budgets" />
        <Kpi
          icon={PiggyBank}
          tone="bg-brand-50 text-brand-700"
          value={money(b.allocated)}
          label="Allocated to marketing"
          detail={b.total ? `${pct(b.allocated, b.total)}% of the budget` : "Add items with a budget line"}
          href="/marketing/planner?view=table"
        />
        <Kpi icon={Receipt} tone="bg-violet-50 text-violet-700" value={money(b.spent)} label="Spent to date" detail={b.allocated ? `${pct(b.spent, b.allocated)}% of what's allocated` : "Recorded under Budgets"} href="/budgets" />
        <Kpi
          icon={CheckCircle2}
          tone={b.remaining < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}
          value={money(b.remaining)}
          label={b.remaining < 0 ? "Over-allocated" : "Left to allocate"}
          detail={b.total ? `${pct(Math.max(b.remaining, 0), b.total)}% of the budget` : "—"}
          href="/budgets"
          alert={b.remaining < 0}
        />
      </section>

      {b.total > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-slate-800">{b.name}</span>
            <span className="text-slate-500">
              {money(b.spent)} spent · {money(Math.max(b.allocated - b.spent, 0))} allocated, not yet spent · {money(Math.max(b.remaining, 0))} free
            </span>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${pct(b.spent, b.total)}% spent, ${pct(Math.max(b.allocated - b.spent, 0), b.total)}% allocated, ${pct(Math.max(b.remaining, 0), b.total)}% free`}>
            <span className="bg-violet-500" style={{ width: `${Math.min(pct(b.spent, b.total), 100)}%` }} />
            <span className="bg-brand-400" style={{ width: `${Math.min(pct(Math.max(b.allocated - b.spent, 0), b.total), 100)}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-violet-500" /> Spent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-400" /> Allocated
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-200" /> Free
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <EntryPanel title="Needs attention" count={d.counts.attention} icon={AlertTriangle} empty="Nothing needs attention." entries={d.attention} accent="text-rose-700" />
        <EntryPanel title="Running now" count={d.counts.running} icon={Play} empty="Nothing in progress right now." entries={d.running} accent="text-sky-700" />
        <EntryPanel title="Upcoming" subtitle="Next 30 days" count={d.counts.upcoming} icon={CalendarClock} empty="Nothing due in the next 30 days." entries={d.upcoming} accent="text-slate-700" href="/marketing/planner" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Allocated by stream" subtitle={b.name ? `Share of ${b.name}` : undefined} href="/marketing/planner?view=table" linkLabel="All items">
          <div className="space-y-0.5 p-3">
            {b.byStream.map((s) => (
              <BarRow
                key={s.key}
                href={`/marketing/${s.key}`}
                label={`${s.label} · ${s.count} ${s.count === 1 ? "item" : "items"}`}
                value={s.amount}
                max={Math.max(b.total, b.allocated, 1)}
                valueLabel={`${money(s.amount)}${b.total ? ` · ${pct(s.amount, b.total)}%` : ""}`}
                barClass={STREAM_BAR[s.key]}
              />
            ))}
          </div>
        </Panel>
        <Panel title="Allocated by item" subtitle="Social, advertising, production and creative">
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
