import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Handshake,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  Sparkles,
  StickyNote,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { StatusSelect } from "@/components/status-select";
import { AssigneeSelect } from "@/components/assignee-select";
import { TaskList } from "@/components/task-list";
import { TaskForm } from "@/components/task-form";
import { DealCard } from "@/components/deal-card";
import { CreateDealForm } from "@/components/create-deal-form";
import { getLeadDetail, getTeamMembers } from "@/lib/leads/queries";
import { getTasksForSubject } from "@/lib/tasks/queries";
import { getDealsForLead } from "@/lib/deals/queries";
import { getInitials } from "@/lib/text";
import { NoteForm } from "./note-form";
import { RevenueForm } from "./revenue-form";

export const dynamic = "force-dynamic";

const ACTIVITY_META: Record<string, { label: string; icon: typeof StickyNote }> = {
  status_change: { label: "Status change", icon: RefreshCw },
  enrichment_run: { label: "Enrichment", icon: Sparkles },
  email_sent: { label: "Email sent", icon: Mail },
  call_logged: { label: "Call", icon: PhoneCall },
  sync_matched: { label: "Data sync", icon: RefreshCw },
  task_completed: { label: "Task completed", icon: CheckCircle2 },
  deal_created: { label: "Deal created", icon: Handshake },
  deal_stage_change: { label: "Deal stage change", icon: TrendingUp },
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, members, tasks, deals] = await Promise.all([
    getLeadDetail(id),
    getTeamMembers(),
    getTasksForSubject({ leadId: id }),
    getDealsForLead(id),
  ]);
  if (!lead) notFound();

  const primaryContact = lead.contacts.find((c) => c.is_primary) ?? lead.contacts[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to board
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(lead.company.name) || <Building2 className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{lead.company.name}</h1>
            <p className="text-sm text-slate-500">
              {lead.company.address_line ?? "No address on file"} · {lead.company.community ?? "Calgary"}
            </p>
            {lead.company.website && (
              <a
                href={lead.company.website}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-600 hover:underline"
              >
                {lead.company.website}
              </a>
            )}
          </div>
        </div>
        <Link
          href={`/companies/${lead.company.id}`}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Company record
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-sm font-semibold text-slate-700">Lead score: {lead.score}/100</h2>
            {lead.scoreReasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {lead.scoreReasons.map((r, i) => (
                  <li key={i}>
                    +{r.points} — {r.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No score breakdown available.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700">Contacts</h2>
            <div className="mt-2 space-y-2">
              {lead.contacts.length === 0 && (
                <p className="text-sm text-slate-400">No contacts found yet — enrichment may not have run.</p>
              )}
              {lead.contacts.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {getInitials(c.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-slate-900">
                      {c.full_name}
                      {c.is_primary && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">Primary</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{c.title ?? "Unknown title"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" strokeWidth={2} />
                          {c.email}
                          {c.email_confidence != null ? ` (${c.email_confidence}% confidence)` : ""}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" strokeWidth={2} />
                          {c.phone}
                        </span>
                      )}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Deals</h2>
              {deals.length === 0 && (
                <CreateDealForm
                  companyId={lead.company.id}
                  leadId={lead.id}
                  primaryContactId={primaryContact?.id ?? null}
                  defaultName={lead.company.name}
                />
              )}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 && <p className="text-sm text-slate-400">No deal yet for this lead.</p>}
              {deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700">Tasks</h2>
            <div className="mt-2">
              <TaskForm leadId={lead.id} />
            </div>
            <div className="mt-3">
              <TaskList tasks={tasks} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700">Activity</h2>
            <div className="mt-2">
              <NoteForm leadId={lead.id} />
            </div>
            <ul className="mt-4 space-y-4 border-l border-slate-200 pl-4">
              {lead.activities.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
              {lead.activities.map((a) => {
                const meta = ACTIVITY_META[a.type] ?? { label: "Note", icon: StickyNote };
                const Icon = meta.icon;
                return (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-slate-100">
                      <Icon className="h-3 w-3 text-slate-400" strokeWidth={2} />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-700">{meta.label}</span>
                      <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.body && <p className="mt-0.5 text-slate-600">{a.body}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead properties</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Status</label>
                <div className="mt-1">
                  <StatusSelect leadId={lead.id} status={lead.status} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Assigned to</label>
                <div className="mt-1">
                  <AssigneeSelect leadId={lead.id} assignedTo={lead.assignedTo} members={members} />
                </div>
              </div>
              <RevenueForm leadId={lead.id} companyId={lead.company.id} value={lead.company.estimated_annual_revenue} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
