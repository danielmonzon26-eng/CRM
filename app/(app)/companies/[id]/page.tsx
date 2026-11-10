import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, CheckSquare2, Handshake, Users } from "lucide-react";
import { getCompanyDetail } from "@/lib/companies/queries";
import { getContactsForLead } from "@/lib/contacts/queries";
import { getTasksForSubject } from "@/lib/tasks/queries";
import { getDealsForCompany } from "@/lib/deals/queries";
import { getDiscoveryCalls } from "@/lib/discovery/queries";
import { getEventRegistrationsForLead } from "@/lib/events/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { canUserSend } from "@/lib/outlook/queries";
import { ContactCards } from "@/components/contact-cards";
import { CreateProposal } from "@/components/create-proposal";
import { DealCard } from "@/components/deal-card";
import { DiscoverySummary } from "@/components/discovery-summary";
import { EventRegistrationsSection } from "@/components/event-registrations-section";
import { LeadProperties } from "@/components/lead-properties";
import { MakeLeadButton } from "@/components/make-lead-button";
import { RecordCommunication } from "@/components/outlook/record-communication";
import { EngagementPill, StatusPill } from "@/components/status-pill";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { buttonClass } from "@/components/ui/button";
import { getInitials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompanyDetail(id);
  if (!company) notFound();
  const lead = company.lead;

  const [user, contacts, tasks, deals, eventRegistrations, discoveryCalls] = await Promise.all([
    getCurrentUser(),
    lead ? getContactsForLead(lead.id) : [],
    getTasksForSubject({ companyId: id, leadId: lead?.id }),
    getDealsForCompany(id),
    lead ? getEventRegistrationsForLead(lead.id) : [],
    lead ? getDiscoveryCalls(lead.id) : [],
  ]);
  const canSend = user ? await canUserSend(user.id) : false;
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const blockedReason = lead?.engagement === "do_not_contact" ? `${company.name} is marked Do Not Contact.` : undefined;
  const openTasks = tasks.filter((t) => !t.completedAt).length;
  const attended = eventRegistrations.filter((r) => r.checkedInAt).length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to companies
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(company.name) || <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{company.name}</h1>
            <p className="text-sm text-slate-500">
              {company.address_line ?? "No address on file"} · {company.community ?? company.city}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {lead ? (
                <>
                  <EngagementPill engagement={lead.engagement} />
                  <StatusPill status={lead.status} />
                </>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Not a lead</span>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead && (
            <Link href={`/leads/${lead.id}`} className={buttonClass("secondary")}>
              Open lead
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          )}
          {(!lead || lead.engagement === "not_engaged" || lead.engagement === "not_qualified") && <MakeLeadButton companyId={company.id} companyName={company.name} stayOnPage={Boolean(lead)} />}
        </div>
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
            <h2 id="contacts-title" className="text-sm font-semibold text-slate-700">Contacts ({contacts.length})</h2>
            <div className="mt-2">
              <ContactCards
                contacts={contacts}
                canSend={canSend}
                blockedReason={blockedReason}
                linkNames
                emptyText={lead ? "No contacts on file yet." : "Make this company a lead to add contacts."}
              />
            </div>
          </section>

          {lead && <DiscoverySummary leadId={lead.id} calls={discoveryCalls} />}

          <section id="proposals" aria-labelledby="proposals-title" className="scroll-mt-20">
            <div className="flex items-center justify-between gap-2">
              <h2 id="proposals-title" className="text-sm font-semibold text-slate-700">Proposals ({deals.length})</h2>
              <CreateProposal companyId={company.id} leadId={company.leadId} primaryContactId={primaryContact?.id ?? null} defaultName={company.name} defaultWorkTypes={lead?.programs ?? []} />
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 && <p className="text-sm text-slate-500">No proposals yet.</p>}
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
            leadId={lead?.id}
            emailTo={primaryContact?.email ?? contacts.find((c) => c.email)?.email}
            blockedReason={blockedReason}
          />

          <section id="tasks" aria-labelledby="tasks-title" className="scroll-mt-20">
            <h2 id="tasks-title" className="text-sm font-semibold text-slate-700">Tasks</h2>
            <div className="mt-2">
              <TaskForm leadId={company.leadId} companyId={company.leadId ? undefined : company.id} />
            </div>
            <div className="mt-4">
              <TaskList tasks={tasks} />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {lead ? (
            <LeadProperties leadId={lead.id} status={lead.status} engagement={lead.engagement} clientType={lead.clientType} programs={lead.programs} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead</h2>
              <p className="mt-2 text-sm text-slate-600">
                This company isn&apos;t a lead. Make it one to track its stage, status, client type and the work we do.
              </p>
              <div className="mt-3">
                <MakeLeadButton companyId={company.id} companyName={company.name} size="sm" />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Detail label="Industry" value={company.industry} />
              <Detail label="Phone" value={company.phone} />
              <Detail label="Postal code" value={company.postal_code} />
              <Detail
                label="Est. annual revenue"
                value={company.estimated_annual_revenue != null ? `$${company.estimated_annual_revenue.toLocaleString()}` : null}
              />
              <Detail label="NAICS code" value={company.naics_code} />
              <Detail label="First seen" value={new Date(company.created_at).toLocaleDateString("en-CA")} />
            </dl>
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

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-words text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
