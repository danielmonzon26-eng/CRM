import Link from "next/link";
import { ArrowRight, Briefcase, Building2, CalendarClock, Handshake, ListChecks, Trophy, Users } from "lucide-react";
import { BarRow, Kpi, money, Panel, PanelEmpty } from "@/components/ui/dashboard";
import { buttonClass } from "@/components/ui/button";
import type { CrmDashboard } from "@/lib/crm/dashboard";
import { STATUS_DOTS } from "@/lib/leads/filters";

const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The CRM landing page: proposals, leads, contacts and companies at a glance, with quick actions. */
export function CrmDashboardView({ d, today }: { d: CrmDashboard; today: string }) {
  const f = d.forecast;
  const decided = f.closedWonCount + f.closedLostCount;
  const winRate = decided ? Math.round((f.closedWonCount / decided) * 100) : null;
  const maxStatus = Math.max(...d.leads.byStatus.map((s) => s.count), 1);
  const topIndustries = d.contactsByIndustry.slice(0, 10);
  const otherIndustries = d.contactsByIndustry.slice(10).reduce((s, x) => s + x.count, 0);
  const maxIndustry = Math.max(...topIndustries.map((x) => x.count), otherIndustries, 1);

  return (
    <div className="space-y-6">
      <section aria-label="Quick actions" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4">
        <div>
          <p className="font-semibold text-slate-900">
            {d.leads.readyForProposal} {d.leads.readyForProposal === 1 ? "lead has" : "leads have"} had a pitch meeting
          </p>
          <p className="text-sm text-slate-600">Turn them into proposals from the Leads page: open a lead and choose Create proposal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads?status=pitch_meeting" className={buttonClass("primary")}>
            Turn a lead into a proposal
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link href="/crm/proposals" className={buttonClass("secondary")}>
            Open proposals
          </Link>
        </div>
      </section>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Handshake} tone="bg-brand-50 text-brand-700" value={money(f.openValue)} label="Open proposals" detail={`${f.openCount} open · ${money(f.weightedValue)} weighted`} href="/crm/proposals" />
        <Kpi
          icon={Trophy}
          tone="bg-emerald-50 text-emerald-700"
          value={winRate === null ? "—" : `${winRate}%`}
          label="Win rate"
          detail={`${f.closedWonCount} accepted (${money(f.closedWonValue)}) · ${f.closedLostCount} declined`}
          href="/crm/proposals"
        />
        <Kpi icon={ListChecks} tone="bg-violet-50 text-violet-700" value={d.leads.total.toLocaleString()} label="Leads" detail={`${d.leads.new30d.toLocaleString()} new in the last 30 days`} href="/leads" />
        <Kpi
          icon={Users}
          tone="bg-sky-50 text-sky-700"
          value={d.contacts.toLocaleString()}
          label="Contacts"
          detail={`At ${d.companies.toLocaleString()} companies`}
          href="/contacts"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Proposals" subtitle="Where every proposal stands" href="/crm/proposals" linkLabel="Proposals">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              ["In development", d.proposals.inDevelopment, "bg-amber-50 text-amber-800"],
              ["Sent", d.proposals.sent, "bg-sky-50 text-sky-800"],
              ["Accepted", d.proposals.accepted, "bg-emerald-50 text-emerald-800"],
              ["Declined", d.proposals.declined, "bg-slate-100 text-slate-700"],
            ].map(([label, n, tone]) => (
              <div key={label as string} className={`rounded-xl p-3 ${tone}`}>
                <p className="text-2xl font-semibold tabular-nums">{n as number}</p>
                <p className="text-xs font-medium">{label as string}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100">
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Next steps due</p>
            {d.nextSteps.length === 0 ? (
              <PanelEmpty icon={CalendarClock}>No next steps with a due date.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.nextSteps.map((p) => {
                  const late = (p.nextStepDueDate ?? "") < today;
                  return (
                    <li key={p.id}>
                      <Link href={`/deals/${p.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {p.companyName}
                            {p.nextStep ? ` · ${p.nextStep}` : ""}
                          </span>
                        </span>
                        <span className={`shrink-0 text-xs font-medium ${late ? "text-rose-700" : "text-slate-600"}`}>
                          {late ? "Overdue · " : ""}
                          {dayFmt.format(new Date(`${p.nextStepDueDate}T00:00:00Z`))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Leads by stage" subtitle={`${d.leads.total.toLocaleString()} leads`} href="/leads" linkLabel="Leads">
          <div className="space-y-0.5 p-3">
            {d.leads.byStatus.map((s) => (
              <BarRow
                key={s.key}
                href={`/leads?status=${s.key}`}
                label={
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOTS[s.key]}`} />
                    {s.label}
                  </span>
                }
                value={s.count}
                max={maxStatus}
                valueLabel={s.count.toLocaleString()}
                barClass={STATUS_DOTS[s.key]}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Contacts by industry" subtitle={`${d.contacts.toLocaleString()} contacts`} href="/contacts" linkLabel="Contacts" className="lg:col-span-2">
          {topIndustries.length === 0 ? (
            <PanelEmpty icon={Users}>No contacts yet.</PanelEmpty>
          ) : (
            <div className="space-y-0.5 p-3">
              {topIndustries.map((x) => (
                <BarRow
                  key={x.industry}
                  href={x.industry === "Not set" ? "/contacts" : `/leads?industry=${encodeURIComponent(x.industry)}`}
                  label={x.industry}
                  value={x.count}
                  max={maxIndustry}
                  valueLabel={`${x.count.toLocaleString()} · ${Math.round((x.count / Math.max(d.contacts, 1)) * 100)}%`}
                  barClass="bg-sky-500"
                />
              ))}
              {otherIndustries > 0 && <BarRow label={`Other industries (${d.contactsByIndustry.length - 10})`} value={otherIndustries} max={maxIndustry} valueLabel={otherIndustries.toLocaleString()} barClass="bg-slate-400" />}
            </div>
          )}
        </Panel>

        <Panel title="Quick links">
          <ul className="divide-y divide-slate-100">
            {[
              { href: "/crm/proposals", label: "Proposals", detail: `${f.openCount} open`, icon: Handshake },
              { href: "/leads", label: "Leads", detail: `${d.leads.total.toLocaleString()} in the funnel`, icon: ListChecks },
              { href: "/contacts", label: "Contacts", detail: `${d.contacts.toLocaleString()} people`, icon: Users },
              { href: "/companies", label: "Companies", detail: `${d.companies.toLocaleString()} companies`, icon: Building2 },
              { href: "/communication", label: "Communication", detail: "Email with leads and clients", icon: Briefcase },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <l.icon className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  <span className="flex-1 text-sm font-medium text-slate-900">{l.label}</span>
                  <span className="text-xs text-slate-500">{l.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
