import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, CheckCircle2, XCircle } from "lucide-react";
import { DealStageSelect } from "@/components/deal-stage-select";
import { ProgramChips } from "@/components/lead-badges";
import { PaymentBadge, StaffAvatars } from "@/components/proposal-fields";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/budgets/money";
import { getDealDetail, getDealStageHistory } from "@/lib/deals/queries";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import { getTeamMembers } from "@/lib/leads/queries";
import { getInitials } from "@/lib/text";
import { ProposalDetailsForm } from "./proposal-details-form";
import { ProposalFiles } from "./proposal-files";

export const dynamic = "force-dynamic";

const ZONE = "America/Edmonton";
const changedAt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });

function formatDay(day: string | null): string {
  if (!day) return "—";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, history, members] = await Promise.all([getDealDetail(id), getDealStageHistory(id), getTeamMembers()]);
  if (!deal) notFound();

  const staff = members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unnamed user" }));
  const nameOf = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const meta = DEAL_STAGE_META[deal.stage];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/crm" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to proposals
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(deal.companyName) || <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{deal.name}</h1>
            <p className="text-sm text-slate-500">
              <Link href={`/companies/${deal.companyId}`} className="font-medium text-slate-700 hover:text-brand-700 hover:underline">
                {deal.companyName}
              </Link>
              {deal.primaryContactName && ` · ${deal.primaryContactName}`}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.pill}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.accent}`} />
                {meta.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(deal.amount)}</span>
              <PaymentBadge payment={deal.payment} />
            </div>
          </div>
        </div>
        {deal.leadId && (
          <Link href={`/leads/${deal.leadId}`} className={buttonClass("secondary")}>
            Lead page
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </header>

      <section aria-label="Stage" className="mt-5">
        <DealStageSelect dealId={deal.id} stage={deal.stage} />
      </section>

      {deal.stage === "accepted" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-medium">Accepted</span> on {formatDay(deal.acceptedOn)}. {deal.companyName} is now a client.
          </span>
        </p>
      )}
      {deal.stage === "declined" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-medium">Declined.</span> {deal.lostReason ?? "Add the reason below so the team can learn from it."}
          </span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="files-title">
            <h2 id="files-title" className="text-sm font-semibold text-slate-700">
              Proposal documents ({deal.files.length})
            </h2>
            <div className="mt-2">
              <ProposalFiles dealId={deal.id} files={deal.files} uploaderNames={nameOf} />
            </div>
          </section>

          <section aria-labelledby="details-title">
            <h2 id="details-title" className="text-sm font-semibold text-slate-700">
              Details
            </h2>
            <div className="mt-2">
              <ProposalDetailsForm deal={deal} staff={staff} />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Value">{formatMoney(deal.amount)}</Row>
              <Row label="Work">{deal.workTypes.length ? <ProgramChips programs={deal.workTypes} /> : "—"}</Row>
              <Row label="Staff">
                <StaffAvatars names={deal.staffIds.map((sid) => nameOf[sid] ?? "Unknown")} max={5} />
              </Row>
              <Row label="Paid or unpaid">{deal.payment ? <PaymentBadge payment={deal.payment} /> : "Not set"}</Row>
              <Row label="Sent">{formatDay(deal.sentOn)}</Row>
              <Row label="Accepted">{formatDay(deal.acceptedOn)}</Row>
              <Row label="Decision expected by">{formatDay(deal.expectedCloseDate)}</Row>
              <Row label="Created">{formatDay(deal.createdAt.slice(0, 10))}</Row>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage history</h2>
            <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4">
              {history.length === 0 && <li className="text-sm text-slate-500">No stage changes yet.</li>}
              {history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span aria-hidden="true" className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DEAL_STAGE_META[h.toStage].accent}`} />
                  <span className="font-medium text-slate-800">{h.fromStage ? DEAL_STAGE_META[h.toStage].label : `Created as ${DEAL_STAGE_META[h.toStage].short}`}</span>
                  <span className="block text-xs text-slate-500">{changedAt.format(new Date(h.changedAt))}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-900">{children}</dd>
    </div>
  );
}
