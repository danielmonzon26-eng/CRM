import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckSquare2,
  Handshake,
  Users,
} from "lucide-react";
import { ActivityCentre } from "@/components/activity-centre";
import { ContactCards } from "@/components/contact-cards";
import { CreateProposal } from "@/components/create-proposal";
import { DealCard } from "@/components/deal-card";
import { DiscoverySummary } from "@/components/discovery-summary";
import { EventRegistrationsSection } from "@/components/event-registrations-section";
import { LeadProperties } from "@/components/lead-properties";
import { RecordCommunication } from "@/components/outlook/record-communication";
import { EngagementPill, StatusPill } from "@/components/status-pill";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { buttonClass } from "@/components/ui/button";
import { getActivityTimeline } from "@/lib/activity/timeline";
import { getCurrentUser } from "@/lib/auth/session";
import { toContactCard } from "@/lib/contacts/queries";
import { getDealsForLead } from "@/lib/deals/queries";
import { getDiscoveryCalls } from "@/lib/discovery/queries";
import { getEventRegistrationsForLead } from "@/lib/events/queries";
import { getLeadDetail } from "@/lib/leads/queries";
import { canUserSend } from "@/lib/outlook/queries";
import { getTasksForSubject } from "@/lib/tasks/queries";
import { getInitials } from "@/lib/text";
import { RevenueForm } from "./revenue-form";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, user, tasks, deals, eventRegistrations, discoveryCalls] = await Promise.all([
    getLeadDetail(id),
    getCurrentUser(),
    getTasksForSubject({ leadId: id }),
    getDealsForLead(id),
    getEventRegistrationsForLead(id),
    getDiscoveryCalls(id),
  ]);
  if (!lead) notFound();

  const contacts = lead.contacts.map((c) => toContactCard({ ...c, lead_id: lead.id }));
  const [canSend, timeline] = await Promise.all([
    user ? canUserSend(user.id).catch(() => false) : false,
    getActivityTimeline(lead.id, contacts.map((c) => c.email).filter((e): e is string => Boolean(e))),
  ]);
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const blockedReason = lead.engagement === "do_not_contact" ? `${lead.company.name} is marked Do Not Contact.` : undefined;
  const openTasks = tasks.filter((t) => !t.completedAt).length;
  const attended = eventRegistrations.filter((r) => r.checkedInAt).length;
  const title = primaryContact ? primaryContact.name : lead.company.name;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to leads
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
            {getInitials(title) || <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold leading-tight tracking-tight sm:text-[2.125rem] text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">
              {primaryContact && (
                <>
                  {primaryContact.title ? `${primaryContact.title} at ` : ""}
                  <Link href={`/companies/${lead.company.id}`} className="font-medium text-slate-700 hover:text-brand-700 hover:underline">
                    {lead.company.name}
                  </Link>
                  {" · "}
                </>
              )}
              {lead.company.community ?? lead.company.address_line ?? "Calgary"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <EngagementPill engagement={lead.engagement} />
              <StatusPill status={lead.status} />
              {lead.company.website && (
                <a href={lead.company.website} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
                  {lead.company.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>
        <Link href={`/companies/${lead.company.id}`} className={buttonClass("secondary")}>
          Company page
          <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Contacts" value={contacts.length} href="#contacts" />
        <Stat icon={Handshake} label="Proposals" value={deals.length} href="#proposals" />
        <Stat icon={CalendarDays} label="Events attended" value={attended} detail={eventRegistrations.length > attended ? `${eventRegistrations.length} registered` : undefined} href="#events" />
        <Stat icon={CheckSquare2} label="Open tasks" value={openTasks} href="#tasks" />
      </dl>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section id="contacts" aria-labelledby="contacts-title" className="scroll-mt-20">
            <h2 id="contacts-title" className="text-sm font-semibold text-slate-700">Contacts at {lead.company.name} ({contacts.length})</h2>
            <div className="mt-2">
              <ContactCards contacts={contacts} canSend={canSend} blockedReason={blockedReason} emptyText="No contacts found yet." />
            </div>
          </section>

          <DiscoverySummary leadId={lead.id} calls={discoveryCalls} />

          <section id="proposals" aria-labelledby="proposals-title" className="scroll-mt-20">
            <div className="flex items-center justify-between gap-2">
              <h2 id="proposals-title" className="text-sm font-semibold text-slate-700">Proposals ({deals.length})</h2>
              <CreateProposal companyId={lead.company.id} leadId={lead.id} primaryContactId={primaryContact?.id ?? null} defaultName={lead.company.name} defaultWorkTypes={lead.programs} />
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 && <p className="text-sm text-slate-500">No proposal yet for this lead.</p>}
              {deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          </section>

          <section id="events" className="scroll-mt-20">
            <EventRegistrationsSection registrations={eventRegistrations} />
          </section>

          <RecordCommunication
            contactEmails={contacts.map((c) => c.email).filter((e): e is string => Boolean(e))}
            leadId={lead.id}
            emailTo={primaryContact?.email ?? contacts.find((c) => c.email)?.email}
            blockedReason={blockedReason}
          />

          <section id="tasks" aria-labelledby="tasks-title" className="scroll-mt-20">
            <h2 id="tasks-title" className="text-sm font-semibold text-slate-700">Tasks</h2>
            <div className="mt-2">
              <TaskForm leadId={lead.id} />
            </div>
            <div className="mt-3">
              <TaskList tasks={tasks} />
            </div>
          </section>

          <ActivityCentre leadId={lead.id} notes={timeline.notes} items={timeline.items} unavailable={timeline.unavailable} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <LeadProperties leadId={lead.id} status={lead.status} engagement={lead.engagement} clientType={lead.clientType} programs={lead.programs} />

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</h2>
            <div className="mt-3">
              <RevenueForm leadId={lead.id} companyId={lead.company.id} value={lead.company.estimated_annual_revenue} />
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Industry</dt>
                <dd className="break-words text-slate-900">{lead.company.industry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-slate-900">{lead.company.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Address</dt>
                <dd className="break-words text-slate-900">{lead.company.address_line ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fit score {lead.score}/100</h2>
            {lead.scoreReasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {lead.scoreReasons.map((r, i) => (
                  <li key={i}>
                    +{r.points} {r.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No score breakdown yet.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  detail?: string;
  href: string;
}) {
  return (
    <a href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card transition-colors hover:border-brand-200">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value.toLocaleString()}
        {detail && <span className="ml-1.5 text-xs font-normal text-slate-500">{detail}</span>}
      </dd>
    </a>
  );
}
