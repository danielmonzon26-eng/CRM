import Link from "next/link";
import { RegistrationBar } from "@/components/registration-progress";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckSquare2,
  ChevronRight,
  Handshake,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { BudgetPicker } from "@/components/budget-switcher";
import { formatMoney } from "@/lib/budgets/money";
import type { DashboardData, DashboardEvent } from "@/lib/dashboard/queries";
import { EVENT_TIME_ZONE, formatEventTime, STATUS_LABELS, STATUS_STYLES } from "@/lib/events/format";

const monthFormat = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, month: "short" });
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, day: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, month: "short", day: "numeric" });
const hourFormat = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

const ACTIVITY_LABELS: Partial<Record<string, string>> = {
  note: "Note added",
  status_change: "Status changed",
  email_sent: "Email sent",
  call_logged: "Call logged",
  task_completed: "Task completed",
  deal_created: "Proposal created",
  deal_stage_change: "Proposal stage changed",
  event_registration: "Event registration",
};

function greeting(now: Date): string {
  const hour = Number(hourFormat.format(now));
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
}

function money(value: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  detail,
  href,
}: {
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-brand-200 hover:shadow-popover">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  href,
  linkLabel = "View all",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-0.5 pt-0.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function PanelEmpty({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-5 py-9 text-center">
      <Icon className="h-5 w-5 text-slate-400" strokeWidth={2} />
      <div className="mt-2 max-w-sm text-sm text-slate-500">{children}</div>
    </div>
  );
}

function EventRow({ event }: { event: DashboardEvent }) {
  return (
    <Link href={`/events/${event.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <span className="text-[10px] font-semibold uppercase leading-none">{monthFormat.format(new Date(event.startsAt))}</span>
        <span className="mt-0.5 text-lg font-semibold leading-none">{dayFormat.format(new Date(event.startsAt))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900">{event.title}</span>
        <span className="block truncate text-xs text-slate-500">
          {event.program ? `${event.program} · ` : ""}
          {event.format === "online" ? "Online" : event.venueName}
        </span>
      </span>
      <span className="hidden w-40 shrink-0 sm:block" title={event.progress.detail}>
        <span className="flex items-baseline justify-between gap-2 text-xs">
          <span className={`rounded px-1.5 py-0.5 font-semibold ${event.progress.tone}`}>{event.progress.label}</span>
          <span className="font-medium tabular-nums text-slate-700">
            {event.registered}
            {event.progress.target ? ` / ${event.progress.target}` : event.capacity ? ` / ${event.capacity}` : ""}
          </span>
        </span>
        {(event.progress.target || event.capacity) && (
          <span className="mt-1.5 block">
            <RegistrationBar progress={event.progress} size="sm" />
          </span>
        )}
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status]}`}>
        {STATUS_LABELS[event.status]}
      </span>
    </Link>
  );
}

export function OverviewDashboard({ data, firstName }: { data: DashboardData; firstName: string | null }) {
  const { kpis } = data;
  const now = new Date();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="relative overflow-hidden rounded-xl bg-ink-950 px-6 py-6 text-white">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-brand-500/25 to-transparent" aria-hidden="true" />
          <h1 className="relative text-3xl font-bold leading-tight tracking-tight sm:text-[2.125rem]">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="relative mt-1 text-sm text-ink-200">Here&apos;s what&apos;s happening across Catapult.</p>
        </header>

        <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Kpi
            icon={CalendarDays}
            tone="bg-brand-50 text-brand-600"
            value={kpis.upcomingEvents.toLocaleString()}
            label="Upcoming events"
            detail={`${kpis.eventsNext30Days} in the next 30 days`}
            href="/events"
          />
          <Kpi
            icon={Ticket}
            tone="bg-sky-50 text-sky-700"
            value={kpis.registrations.toLocaleString()}
            label="Registrations"
            detail={`${kpis.registrationsThisWeek} in the last 7 days`}
            href="/events"
          />
          <Kpi
            icon={BarChart3}
            tone="bg-amber-50 text-amber-700"
            value={kpis.attendancePercent === null ? "—" : `${kpis.attendancePercent}%`}
            label="Avg. attendance"
            detail={kpis.attendancePercent === null ? "After your first check-ins" : "Checked in at past events"}
            href="/events"
          />
          <Kpi
            icon={Users}
            tone="bg-slate-100 text-slate-600"
            value={kpis.contacts.toLocaleString()}
            label="Contacts"
            detail="All CRM contacts"
            href="/contacts"
          />
          <Kpi
            icon={Handshake}
            tone="bg-accent-50 text-accent-700"
            value={kpis.openDeals.toLocaleString()}
            label="Open proposals"
            detail={`${money(kpis.openDealValue)} open`}
            href="/crm/proposals"
          />
          <Kpi
            icon={Wallet}
            tone="bg-emerald-50 text-emerald-700"
            value={data.budget ? `${data.budget.percentUsed}%` : "—"}
            label="Budget utilization"
            detail={data.budget ? `${formatMoney(data.budget.spent)} of ${formatMoney(data.budget.approved)}` : "No budget yet"}
            href="/budgets"
          />
          <Kpi
            icon={AlertTriangle}
            tone={kpis.overdueTasks > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}
            value={kpis.overdueTasks.toLocaleString()}
            label="Overdue tasks"
            detail={kpis.overdueTasks > 0 ? "Need attention" : "All caught up"}
            href="/tasks"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-5">
            <Panel title="Upcoming events" href="/events">
              {data.upcomingEvents.length === 0 ? (
                <PanelEmpty icon={CalendarDays}>
                  No upcoming events.{" "}
                  <Link href="/events/new" className="font-medium text-brand-600 hover:underline">Create one</Link>
                </PanelEmpty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)}
                </div>
              )}
            </Panel>

            <Panel title="Tasks due" subtitle="Overdue and the next 7 days" href="/tasks">
              {data.tasksDue.length === 0 ? (
                <PanelEmpty icon={CheckSquare2}>Nothing due in the next 7 days.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.tasksDue.map((task) => {
                    const overdue = new Date(task.dueAt).getTime() < now.getTime();
                    return (
                      <li key={task.id}>
                        <Link href={task.href} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                          <span className="min-w-0 truncate text-slate-800">{task.title}</span>
                          <span className={`shrink-0 text-xs font-medium ${overdue ? "text-rose-700" : "text-slate-500"}`}>
                            {overdue ? "Overdue · " : ""}
                            {shortDateFormat.format(new Date(task.dueAt))}, {formatEventTime(task.dueAt)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Program performance">
              {data.programs.length === 0 ? (
                <PanelEmpty icon={BarChart3}>Figures appear once you have events.</PanelEmpty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th scope="col" className="px-5 py-2.5 font-medium">Program</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Events</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Registrations</th>
                        <th scope="col" className="px-5 py-2.5 text-right font-medium">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                      {data.programs.map((p) => (
                        <tr key={p.name}>
                          <td className="px-5 py-2.5 font-medium text-slate-800">{p.name}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{p.events}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{p.registrations}</td>
                          <td className="px-5 py-2.5 text-right text-slate-600">
                            {p.attendancePercent === null ? "—" : `${p.attendancePercent}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-5">
            <Panel
              title="Leads requiring attention"
              subtitle={`Highest-scoring of ${data.unassignedLeadCount.toLocaleString()} active leads with no owner`}
              href="/leads"
            >
              {data.leadsNeedingAttention.length === 0 ? (
                <PanelEmpty icon={Sparkles}>Every active lead has an owner.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.leadsNeedingAttention.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                        <span className="min-w-0 truncate font-medium text-slate-800">{lead.companyName}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          <span className="capitalize">{lead.status}</span> · Score {lead.score}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent registrations" href="/events">
              {data.registrations.length === 0 ? (
                <PanelEmpty icon={UserPlus}>No registrations yet.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.registrations.map((r) => (
                    <li key={r.id}>
                      <Link href={`/events/${r.eventId}`} className="block px-5 py-2.5 text-sm hover:bg-slate-50">
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium text-slate-800">{r.fullName}</span>
                          <span className="shrink-0 text-xs text-slate-500">{shortDateFormat.format(new Date(r.createdAt))}</span>
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {r.companyName ? `${r.companyName} · ` : ""}
                          {r.eventTitle}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent CRM activity">
              {data.activity.length === 0 ? (
                <PanelEmpty icon={Sparkles}>No activity yet.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.activity.map((a) => (
                    <li key={a.id}>
                      <Link href={`/leads/${a.leadId}`} className="block px-5 py-2.5 text-sm hover:bg-slate-50">
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium text-slate-800">{a.companyName}</span>
                          <span className="shrink-0 text-xs text-slate-500">{shortDateFormat.format(new Date(a.createdAt))}</span>
                        </span>
                        <span className="block truncate text-xs text-slate-500">{a.body ?? ACTIVITY_LABELS[a.type] ?? "Activity"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Budget alerts" subtitle={data.budget?.budgetName} href="/budgets" linkLabel="Budgets">
              {data.budget && data.budget.budgets.length > 1 && (
                <div className="border-b border-slate-100 px-5 py-2.5">
                  <BudgetPicker budgets={data.budget.budgets} selectedId={data.budget.budgetId} className="w-full" />
                </div>
              )}
              {!data.budget ? (
                <PanelEmpty icon={Wallet}>Alerts appear here once a budget is created.</PanelEmpty>
              ) : data.budget.alerts.length === 0 ? (
                <PanelEmpty icon={Wallet}>No lines are near or over budget.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.budget.alerts.map((alert) => (
                    <li key={alert.lineId}>
                      <Link href={`/budgets/lines/${alert.lineId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                        <span className="min-w-0 truncate font-medium text-slate-800">{alert.name}</span>
                        <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${alert.over ? "text-rose-700" : "text-amber-700"}`}>
                          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                          {alert.percentUsed}% used{alert.over ? " · Over budget" : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
