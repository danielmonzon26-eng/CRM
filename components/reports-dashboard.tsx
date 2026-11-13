import Link from "next/link";
import { BarChart3, CalendarCheck, Handshake, Megaphone, Trophy, Users, Wallet } from "lucide-react";
import { BarRow, Kpi, money, Panel, PanelEmpty } from "@/components/ui/dashboard";
import { STATUS_LABELS } from "@/lib/leads/filters";
import type { ReportsDashboard as Data } from "@/lib/reports/dashboard";

/** The headline numbers and panels at the top of Reports. */
export function ReportsDashboard({ d }: { d: Data }) {
  const maxStage = Math.max(1, ...d.stages.map((s) => s.count));
  const t = d.upcomingTotals;
  return (
    <div className="space-y-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} tone="bg-sky-50 text-sky-700" value={d.activeLeads.toLocaleString("en-CA")} label="Leads in the funnel" detail={`${d.clients} ${d.clients === 1 ? "client" : "clients"}`} href="/leads?engagement=all&view=all" />
        <Kpi
          icon={Handshake}
          tone="bg-brand-50 text-brand-700"
          value={money(d.pipeline.openValue)}
          label="Open proposals"
          detail={`${d.pipeline.openCount} open · ${money(d.pipeline.weightedValue)} weighted`}
          href="/crm"
        />
        <Kpi
          icon={Trophy}
          tone="bg-emerald-50 text-emerald-700"
          value={d.pipeline.winRate === null ? "—" : `${d.pipeline.winRate}%`}
          label="Win rate"
          detail={`${d.pipeline.closedWonCount} accepted · ${d.pipeline.closedLostCount} declined`}
          href="/crm"
        />
        <Kpi
          icon={CalendarCheck}
          tone="bg-violet-50 text-violet-700"
          value={t.target ? `${t.registered} / ${t.target}` : String(t.registered)}
          label="Registered, next 90 days"
          detail={t.target ? `Against targets on ${t.eventsWithTarget} ${t.eventsWithTarget === 1 ? "event" : "events"}` : "No targets set"}
          href="/events"
        />
        <Kpi
          icon={Wallet}
          tone={d.budget && d.budget.percentUsed > 100 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}
          value={d.budget ? `${d.budget.percentUsed}%` : "—"}
          label="Budget used"
          detail={d.budget ? `${money(d.budget.spent)} of ${money(d.budget.approved)}` : "No budget yet"}
          href="/budgets"
          alert={!!d.budget && d.budget.percentUsed > 100}
        />
        <Kpi
          icon={Megaphone}
          tone="bg-pink-50 text-pink-700"
          value={String(d.marketing.approvedThisMonth)}
          label={`Posts approved, ${d.marketing.monthLabel}`}
          detail={d.marketing.waiting ? `${d.marketing.waiting} waiting approval` : "None waiting"}
          href="/marketing"
          alert={d.marketing.waiting > 0}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Lead funnel" subtitle="Every lead by stage" href="/leads?engagement=all&view=all" linkLabel="Leads">
          <div className="space-y-0.5 p-3">
            {d.stages.map((s) => (
              <BarRow
                key={s.status}
                href={`/leads?engagement=all&view=all&status=${s.status}`}
                label={STATUS_LABELS[s.status]}
                value={s.count}
                max={maxStage}
                valueLabel={s.openValue > 0 ? `${s.count.toLocaleString("en-CA")} · ${money(s.openValue)} open` : s.count.toLocaleString("en-CA")}
                barClass={s.status === "client" ? "bg-emerald-500" : "bg-brand-500"}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Upcoming events" subtitle="Registered against target (the line), next 90 days" href="/events" linkLabel="Events">
          {d.upcoming.length === 0 ? (
            <PanelEmpty icon={CalendarCheck}>No published events in the next 90 days.</PanelEmpty>
          ) : (
            <div className="space-y-0.5 p-3">
              {d.upcoming.map((e) => {
                const p = e.progress;
                const max = Math.max(p.capacity ?? 0, p.target ?? 0, p.registered, 1);
                return (
                  <BarRow
                    key={e.id}
                    href={`/events/${e.id}`}
                    label={
                      <>
                        <span className="text-slate-500">{e.whenLabel}</span> {e.title}{" "}
                        {p.status !== "no_target" && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${p.tone}`}>{p.label}</span>}
                      </>
                    }
                    value={p.registered}
                    max={max}
                    target={p.target}
                    valueLabel={p.target ? `${p.registered} / ${p.target}` : `${p.registered} registered`}
                    barClass={
                      !p.target && !p.capacity
                        ? "bg-slate-300"
                        : p.status === "behind"
                          ? "bg-amber-500"
                          : p.status === "reached" || p.status === "full"
                            ? "bg-emerald-500"
                            : "bg-brand-500"
                    }
                  />
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Recent attendance" subtitle="Checked in of registered, last 4 months" href="#event-detail-title" linkLabel="Details">
          {d.recent.length === 0 ? (
            <PanelEmpty icon={BarChart3}>No events in the last four months.</PanelEmpty>
          ) : (
            <div className="space-y-0.5 p-3">
              {d.recent.map((e) => (
                <BarRow
                  key={e.id}
                  href={`/events/${e.id}`}
                  label={
                    <>
                      <span className="text-slate-500">{e.whenLabel}</span> {e.title}
                    </>
                  }
                  value={e.checkedIn}
                  max={Math.max(e.registered, 1)}
                  valueLabel={`${e.checkedIn} of ${e.registered}${e.attendancePercent !== null ? ` · ${e.attendancePercent}%` : ""}`}
                  barClass="bg-violet-500"
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Budget" subtitle={d.budget ? d.budget.budgetName : "No budget yet"} href="/budgets" linkLabel="Budgets">
          {!d.budget ? (
            <PanelEmpty icon={Wallet}>Create a budget to track spending here.</PanelEmpty>
          ) : (
            <div className="space-y-3 p-5">
              <BarRow
                label="Spent and committed"
                value={d.budget.spent}
                max={Math.max(d.budget.approved, d.budget.spent, 1)}
                valueLabel={`${money(d.budget.spent)} of ${money(d.budget.approved)}`}
                barClass={d.budget.percentUsed > 100 ? "bg-rose-500" : d.budget.percentUsed >= 90 ? "bg-amber-500" : "bg-emerald-500"}
              />
              {d.budget.alerts.length === 0 ? (
                <p className="px-2 text-sm text-slate-500">No lines are near their limit.</p>
              ) : (
                <ul className="space-y-1 px-2 text-sm">
                  {d.budget.alerts.slice(0, 5).map((a) => (
                    <li key={a.lineId} className="flex items-center justify-between gap-3">
                      <Link href={`/budgets/lines/${a.lineId}`} className="min-w-0 truncate text-slate-700 hover:text-brand-700 hover:underline">
                        {a.name}
                      </Link>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${a.over ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
                        {a.over ? "Over" : "Near limit"} · {a.percentUsed}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
