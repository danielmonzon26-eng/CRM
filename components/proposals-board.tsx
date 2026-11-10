"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileText, GripVertical, MoreHorizontal, Paperclip, SearchX } from "lucide-react";
import { updateDealStage } from "@/app/actions/deals";
import { ProgramChips } from "@/components/lead-badges";
import { PaymentBadge, StaffAvatars } from "@/components/proposal-fields";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { EmptyState } from "@/components/ui/page";
import { formatMoney } from "@/lib/budgets/money";
import type { ProposalRow } from "@/lib/deals/queries";
import { DEAL_STAGES, DEAL_STAGE_META, OPEN_DEAL_STAGES, PAYMENT_LABELS } from "@/lib/deals/stages";
import { CLIENT_TYPES, LEAD_PROGRAMS, clientTypeLabel } from "@/lib/leads/classification";
import type { DealStage } from "@/lib/supabase/types";

const MAX_CARD_PROGRAMS = 2;

type Sort = "closing" | "largest" | "newest";
export type ProposalBoardFilters = { q: string; staff: string; clientType: string; work: string; payment: string };

const SORTERS: Record<Sort, (a: ProposalRow, b: ProposalRow) => number> = {
  closing: (a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate),
  largest: (a, b) => b.amount - a.amount,
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function ProposalCard({
  proposal,
  staffNames,
  today,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  proposal: ProposalRow;
  staffNames: string[];
  today: string;
  onDragStart: (proposal: ProposalRow) => void;
  onDragEnd: () => void;
  onMove: (proposal: ProposalRow, stage: DealStage) => void;
}) {
  const overdue = OPEN_DEAL_STAGES.includes(proposal.stage) && proposal.expectedCloseDate < today;
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", proposal.id);
        // The whole card follows the pointer, even when the drag starts on its link.
        e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
        onDragStart(proposal);
      }}
      onDragEnd={onDragEnd}
      className="group relative cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-card active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Link href={`/deals/${proposal.id}`} className="min-w-0 flex-1 font-medium leading-snug text-slate-900 after:absolute after:inset-0 after:rounded-lg hover:text-brand-700">
          <span className="line-clamp-2 text-sm">{proposal.name}</span>
        </Link>
        <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {proposal.clientType && <span className="font-medium text-slate-700">{clientTypeLabel(proposal.clientType)}</span>}
        {proposal.clientType && proposal.companyName !== proposal.name ? " · " : ""}
        {proposal.companyName !== proposal.name ? proposal.companyName : ""}
      </p>
      <p className="mt-2 text-base font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(proposal.amount)}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-rose-700" : "text-slate-600"}`}>
        <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={2} />
        {proposal.stage === "accepted"
          ? `Accepted ${proposal.acceptedOn ? formatDay(proposal.acceptedOn) : ""}`
          : proposal.stage === "declined"
            ? `Declined ${proposal.closedAt ? formatDay(proposal.closedAt.slice(0, 10)) : ""}`
            : proposal.stage === "sent" && proposal.sentOn
              ? `Sent ${formatDay(proposal.sentOn)}${overdue ? " · decision overdue" : ""}`
              : `${overdue ? "Decision overdue: " : "Decision by "}${formatDay(proposal.expectedCloseDate)}`}
      </p>
      {proposal.nextStep && <p className="mt-1 truncate text-xs text-slate-600">Next: {proposal.nextStep}</p>}
      {proposal.workTypes.length > 0 && (
        <div className="mt-2">
          <ProgramChips programs={proposal.workTypes} limit={MAX_CARD_PROGRAMS} />
        </div>
      )}
      <div className="relative z-10 mt-2.5 flex items-center justify-end gap-1.5">
        <PaymentBadge payment={proposal.payment} />
        {proposal.fileCount > 0 && (
          <span title={`${proposal.fileCount} file${proposal.fileCount === 1 ? "" : "s"}`} className="flex items-center gap-0.5 text-[11px] text-slate-500">
            <Paperclip aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
            {proposal.fileCount}
          </span>
        )}
        <span className="ml-auto" />
        <StaffAvatars names={staffNames} />
        {/* Dragging needs a mouse, so moving also works from the keyboard and on touch. */}
        <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100 focus-within:bg-slate-100">
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          <span className="sr-only">Move {proposal.name} to another stage</span>
          <select value={proposal.stage} onChange={(e) => onMove(proposal, e.target.value as DealStage)} className="absolute inset-0 cursor-pointer opacity-0">
            {DEAL_STAGES.map((stage) => <option key={stage} value={stage}>Move to {DEAL_STAGE_META[stage].label}</option>)}
          </select>
        </label>
      </div>
    </article>
  );
}

export function ProposalsBoard({
  proposals,
  members,
  initialFilters,
  today,
}: {
  proposals: ProposalRow[];
  members: { id: string; name: string }[];
  initialFilters: ProposalBoardFilters;
  today: string;
}) {
  const { toast } = useFeedback();
  const [local, setLocal] = useState(proposals);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<Sort>("closing");
  const [dragging, setDragging] = useState<ProposalRow | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  useEffect(() => setLocal(proposals), [proposals]);

  function setFilter(patch: Partial<ProposalBoardFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // Kept in the address, so a filtered board can be bookmarked or shared.
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const staffNames = (ids: string[]) => ids.map((id) => members.find((m) => m.id === id)?.name ?? "Unknown");

  const visible = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return local
      .filter((p) => {
        if (term && ![p.name, p.companyName, p.primaryContactName].some((text) => text?.toLowerCase().includes(term))) return false;
        if (filters.staff && (filters.staff === "none" ? p.staffIds.length > 0 : !p.staffIds.includes(filters.staff))) return false;
        if (filters.clientType && p.clientType !== filters.clientType) return false;
        if (filters.work && !p.workTypes.includes(filters.work)) return false;
        if (filters.payment && (filters.payment === "none" ? p.payment !== null : p.payment !== filters.payment)) return false;
        return true;
      })
      .sort(SORTERS[sort]);
  }, [local, filters, sort]);

  async function move(proposal: ProposalRow, to: DealStage) {
    if (proposal.stage === to) return;
    const before = local;
    // Moves immediately, and puts the card back if saving fails.
    setLocal((current) => current.map((p) => (p.id === proposal.id ? { ...p, stage: to } : p)));
    try {
      await updateDealStage(proposal.id, to);
      toast(`${proposal.name} moved to ${DEAL_STAGE_META[to].label}`);
    } catch {
      setLocal(before);
      toast(`${proposal.name} didn't move. Please try again.`, "error");
    }
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No proposals yet"
        description="Find a lead in the Leads table and choose Create proposal to start tracking it here."
        action={<Link href="/leads" className={buttonClass("primary")}>Go to Leads</Link>}
      />
    );
  }

  const hasFilters = Boolean(filters.q || filters.staff || filters.clientType || filters.work || filters.payment);

  return (
    <div>
      <SearchField className="mb-3" label="Search proposals" placeholder="Search by proposal, company, or contact..." value={filters.q} onChange={(q) => setFilter({ q })} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect label="Client type" value={filters.clientType} onChange={(clientType) => setFilter({ clientType })} options={CLIENT_TYPES.map(([value, label]) => ({ value: value as string, label }))} />
        <FilterSelect label="Work" value={filters.work} onChange={(work) => setFilter({ work })} options={LEAD_PROGRAMS.map(([value, label]) => ({ value: value as string, label }))} />
        <FilterSelect label="Staff" value={filters.staff} allLabel="Anyone" onChange={(staff) => setFilter({ staff })} options={[{ value: "none", label: "No staff yet" }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
        <FilterSelect label="Paid" value={filters.payment} allLabel="Any" onChange={(payment) => setFilter({ payment })} options={[{ value: "paid", label: PAYMENT_LABELS.paid }, { value: "unpaid", label: PAYMENT_LABELS.unpaid }, { value: "none", label: "Not set" }]} />
        <FilterSelect label="Sort" required value={sort} onChange={(value) => setSort(value as Sort)} options={[{ value: "closing", label: "Closing soonest" }, { value: "largest", label: "Largest" }, { value: "newest", label: "Newest" }]} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No proposals match"
          description="Try a different search or remove a filter."
          action={hasFilters ? <button type="button" onClick={() => setFilter({ q: "", staff: "", clientType: "", work: "", payment: "" })} className={buttonClass("secondary")}>Clear filters</button> : undefined}
        />
      ) : (
        <div className="relative -mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 lg:grid-flow-row lg:grid-cols-4">
            {DEAL_STAGES.map((stage) => {
              const cards = visible.filter((p) => p.stage === stage);
              const value = cards.reduce((total, p) => total + p.amount, 0);
              const isTarget = overStage === stage && dragging?.stage !== stage;
              return (
                <section
                  key={stage}
                  aria-label={`${DEAL_STAGE_META[stage].label}, ${cards.length} proposals`}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setOverStage(stage);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging) void move(dragging, stage);
                    setDragging(null);
                    setOverStage(null);
                  }}
                  className={`flex min-w-0 flex-col rounded-xl border bg-slate-50/70 transition-colors ${isTarget ? "border-brand-400 bg-brand-50/60" : "border-slate-200"}`}
                >
                  <header className={`rounded-t-xl border-b px-3 py-2.5 ${DEAL_STAGE_META[stage].header}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <span className={`h-2 w-2 rounded-full ${DEAL_STAGE_META[stage].accent}`} />
                        {DEAL_STAGE_META[stage].label}
                      </h2>
                      <span className="text-sm font-medium tabular-nums text-slate-700">{cards.length}</span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-600">{formatMoney(value)}</p>
                  </header>
                  <div className="flex max-h-[calc(100vh-20rem)] min-h-40 flex-col gap-2 overflow-y-auto p-2">
                    {cards.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        staffNames={staffNames(proposal.staffIds)}
                        today={today}
                        onDragStart={setDragging}
                        onDragEnd={() => {
                          setDragging(null);
                          setOverStage(null);
                        }}
                        onMove={(p, to) => void move(p, to)}
                      />
                    ))}
                    {cards.length === 0 && <p className="px-2 py-8 text-center text-xs text-slate-500">{isTarget ? "Drop here" : "No proposals"}</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
