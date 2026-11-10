"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  SearchX,
  X,
} from "lucide-react";
import { bulkChangeLeadProgram, bulkUpdateLeads, exportLeadsBatch } from "@/app/actions/leads";
import { CreateProposal } from "@/components/create-proposal";
import { ProgramChips } from "@/components/lead-badges";
import { LeadQuickEdit } from "@/components/lead-quick-edit";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { EmptyState } from "@/components/ui/page";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import { downloadCsv } from "@/lib/csv";
import { industryOptions, parseIndustry } from "@/lib/industries/naics";
import { CLIENT_TYPES, LEAD_PROGRAMS, clientTypeLabel, programLabel } from "@/lib/leads/classification";
import {
  ALL_ENGAGEMENTS,
  ALL_STATUSES,
  ENGAGEMENT_LABELS,
  STATUS_DOTS,
  STATUS_LABELS,
  TABLE_PAGE_SIZE,
  leadViewToParams,
  type LeadSort,
  type LeadViewState,
} from "@/lib/leads/filters";
import type { LeadFacets, LeadRow, StageSummary } from "@/lib/leads/search";
import type { DealStage, LeadEngagement, LeadStatus } from "@/lib/supabase/types";

const SEARCH_DELAY_MS = 250;
const EXPORT_CAP = 10000;

const SCORE_LABELS: Record<string, string> = { "40": "Fit 40+", "70": "Fit 70+" };
const NOT_SET_LABEL = "Not set";
const MAX_ROW_PROGRAMS = 2;
const CONTACT_LABELS: Record<string, string> = { has_contact: "Has a contact", has_email: "Has an email", none: "No contact" };
const PROPOSAL_LABELS: Record<string, string> = { has: "Has a proposal", none: "No proposal" };

type Member = { id: string; name: string };

function FitBadge({ score }: { score: number }) {
  // A score of 0 means not scored yet, so it isn't shown as a rating.
  if (score <= 0) return null;
  const tone = score >= 70 ? "bg-emerald-50 text-emerald-800" : score >= 40 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span title="Fit score out of 100" className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>Fit {score}</span>;
}

function SortHeader({
  label,
  sort,
  state,
  href,
  align = "left",
}: {
  label: string;
  sort: LeadSort;
  state: LeadViewState;
  href: (patch: Partial<LeadViewState>) => string;
  align?: "left" | "right";
}) {
  const active = state.sort === sort;
  const Icon = active ? (state.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (state.desc ? "descending" : "ascending") : "none"} className={`px-2 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
      <Link
        href={href({ sort, desc: active ? !state.desc : sort === "score" || sort === "created", page: 1 })}
        scroll={false}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} strokeWidth={2} />
      </Link>
    </th>
  );
}

function LeadsTable({
  rows,
  total,
  state,
  members,
  facets,
  href,
}: {
  rows: LeadRow[];
  total: number;
  state: LeadViewState;
  members: Member[];
  facets: LeadFacets;
  href: (patch: Partial<LeadViewState>) => string;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setSelected(new Set()), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const start = total === 0 ? 0 : (state.page - 1) * TABLE_PAGE_SIZE + 1;
  const end = Math.min(state.page * TABLE_PAGE_SIZE, total);
  const lastPage = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE));

  function apply(change: { status?: LeadStatus; engagement?: LeadEngagement; clientType?: string | null }, description: string) {
    startTransition(async () => {
      const result = await bulkUpdateLeads([...selected], change);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(`${result.updated} ${result.updated === 1 ? "lead" : "leads"} ${description}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function changeProgram(value: string) {
    const add = value.startsWith("+");
    const program = value.slice(1);
    startTransition(async () => {
      const result = await bulkChangeLeadProgram([...selected], program, add);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(`${programLabel(program)} ${add ? "added to" : "removed from"} ${result.updated} ${result.updated === 1 ? "lead" : "leads"}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="animate-pop mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-ink-950 px-4 py-2 text-sm text-white">
          <span className="font-medium">{selected.size} selected</span>
          <select
            aria-label="Set stage on selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => e.target.value && apply({ status: e.target.value as LeadStatus }, `moved to ${STATUS_LABELS[e.target.value as LeadStatus]}`)}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Set stage...</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select
            aria-label="Set status on selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => e.target.value && apply({ engagement: e.target.value as LeadEngagement }, `set to ${ENGAGEMENT_LABELS[e.target.value as LeadEngagement]}`)}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Set status...</option>
            {ALL_ENGAGEMENTS.map((s) => <option key={s} value={s}>{ENGAGEMENT_LABELS[s]}</option>)}
          </select>
          <select
            aria-label="Set client type on selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const type = e.target.value === "none" ? null : e.target.value;
              apply({ clientType: type }, type ? `set to ${clientTypeLabel(type)}` : "cleared of client type");
            }}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Set client type...</option>
            {CLIENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option value="none">Not set</option>
          </select>
          <select
            aria-label="Add or remove work on selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => e.target.value && changeProgram(e.target.value)}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Change work...</option>
            <optgroup label="Add">
              {LEAD_PROGRAMS.map(([value, label]) => <option key={value} value={`+${value}`}>Add {label}</option>)}
            </optgroup>
            <optgroup label="Remove">
              {LEAD_PROGRAMS.map(([value, label]) => <option key={value} value={`-${value}`}>Remove {label}</option>)}
            </optgroup>
          </select>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-ink-200 hover:text-white">Clear</button>
        </div>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[1220px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 accent-brand-600"
                />
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium">Name</th>
              <SortHeader label="Company" sort="name" state={state} href={href} />
              <SortHeader label="Client type" sort="client_type" state={state} href={href} />
              <th scope="col" className="px-2 py-2.5 font-medium">Work</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Industry</th>
              <SortHeader label="Fit" sort="score" state={state} href={href} />
              <SortHeader label="Stage" sort="status" state={state} href={href} />
              <SortHeader label="Added" sort="created" state={state} href={href} />
              {/* Stays in view while the rest of the table scrolls sideways. */}
              <th scope="col" className="sticky right-0 border-l border-slate-100 bg-white px-3 py-2.5 font-medium">Proposal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((lead) => (
              <tr key={lead.id} className={`group transition-colors hover:bg-slate-50 ${selected.has(lead.id) ? "bg-brand-50/50" : ""}`}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.companyName}`}
                    checked={selected.has(lead.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(lead.id)) next.delete(lead.id);
                        else next.add(lead.id);
                        return next;
                      })
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                </td>
                <td className="max-w-52 px-2 py-2.5 text-slate-700">
                  {lead.primaryName ? (
                    <>
                      <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {lead.primaryName}
                        {lead.contactCount > 1 && <span className="font-normal text-slate-500"> +{lead.contactCount - 1}</span>}
                      </Link>
                      {(lead.primaryTitle || lead.primaryEmail) && <span className="block truncate text-xs text-slate-500">{lead.primaryTitle ?? lead.primaryEmail}</span>}
                    </>
                  ) : (
                    <Link href={`/leads/${lead.id}`} className="text-slate-500 hover:text-brand-700 hover:underline">None yet</Link>
                  )}
                </td>
                <td className="max-w-56 px-2 py-2.5">
                  <Link href={`/companies/${lead.companyId}`} className="block truncate font-medium text-slate-900 hover:text-brand-700 hover:underline">{lead.companyName}</Link>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">{clientTypeLabel(lead.clientType) ?? <span className="text-slate-500">—</span>}</td>
                <td className="min-w-36 max-w-64 px-2 py-2.5">{lead.programs.length ? <ProgramChips programs={lead.programs} limit={MAX_ROW_PROGRAMS} /> : <span className="text-slate-500">—</span>}</td>
                <td className="max-w-40 px-2 py-2.5 text-slate-700">
                  <span title={lead.industry ?? undefined} className="block truncate">{parseIndustry(lead.industry)?.subsector ?? lead.industry ?? "—"}</span>
                  {lead.community && <span className="block truncate text-xs text-slate-500">{lead.community}</span>}
                </td>
                <td className="px-2 py-2.5">{lead.score > 0 ? <FitBadge score={lead.score} /> : <span className="text-slate-500">—</span>}</td>
                <td className="px-2 py-2.5">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[lead.status]}`} />
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-500">{lead.createdAt.slice(0, 10)}</td>
                <td className={`sticky right-0 whitespace-nowrap border-l border-slate-100 px-3 py-2 transition-colors group-hover:bg-slate-50 ${selected.has(lead.id) ? "bg-brand-50" : "bg-white"}`}>
                  <div className="flex items-center justify-between gap-1">
                    {lead.proposalId && lead.proposalStage ? (
                      <Link href={`/deals/${lead.proposalId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline">
                        <span className={`h-2 w-2 rounded-full ${DEAL_STAGE_META[lead.proposalStage as DealStage].accent}`} />
                        {DEAL_STAGE_META[lead.proposalStage as DealStage].label}
                      </Link>
                    ) : (
                      <CreateProposal
                        compact
                        stayOnPage
                        companyId={lead.companyId}
                        leadId={lead.id}
                        primaryContactId={lead.primaryContactId}
                        defaultName={lead.companyName}
                      />
                    )}
                    <button
                      type="button"
                      title="Quick edit"
                      aria-label={`Quick edit ${lead.companyName}`}
                      onClick={() => setEditing(lead)}
                      className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
        <nav aria-label="Pages" className="flex items-center gap-2">
          <Link href={href({ page: state.page - 1 })} scroll={false} aria-disabled={state.page <= 1} className={`${buttonClass("secondary", "sm")} ${state.page <= 1 ? "pointer-events-none opacity-40" : ""}`}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Previous
          </Link>
          <span className="text-xs">Page {state.page} of {lastPage.toLocaleString()}</span>
          <Link href={href({ page: state.page + 1 })} scroll={false} aria-disabled={state.page >= lastPage} className={`${buttonClass("secondary", "sm")} ${state.page >= lastPage ? "pointer-events-none opacity-40" : ""}`}>
            Next
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </nav>
      </div>

      {editing && (
        <LeadQuickEdit
          key={editing.id}
          leadId={editing.id}
          companyName={editing.companyName}
          members={members}
          facets={facets}
          onClosed={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function LeadsWorkspace({
  state,
  table,
  stages,
  facets,
  members,
  events,
}: {
  state: LeadViewState;
  table: { rows: LeadRow[]; total: number };
  stages: StageSummary[];
  facets: LeadFacets;
  members: Member[];
  events: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [isNavigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(state.q);
  const [isExporting, setIsExporting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const href = (patch: Partial<LeadViewState>) => {
    const query = leadViewToParams({ ...state, ...patch }).toString();
    return query ? `/leads?${query}` : "/leads";
  };
  const go = (patch: Partial<LeadViewState>) => startNavigation(() => router.replace(href({ page: 1, ...patch }), { scroll: false }));

  useEffect(() => setSearch(state.q), [state.q]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function onSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => go({ q: value.trim() }), SEARCH_DELAY_MS);
  }

  const matching = state.status
    ? stages.find((s) => s.status === state.status)?.count ?? 0
    : stages.reduce((total, s) => total + s.count, 0);

  const chips: { label: string; clear: Partial<LeadViewState> }[] = [
    ...(state.q ? [{ label: `Search: ${state.q}`, clear: { q: "" } }] : []),
    ...(state.status ? [{ label: `Stage: ${STATUS_LABELS[state.status as LeadStatus]}`, clear: { status: "" } }] : []),
    ...(state.clientType ? [{ label: `Client type: ${state.clientType === "none" ? NOT_SET_LABEL : clientTypeLabel(state.clientType)}`, clear: { clientType: "" } }] : []),
    ...(state.program ? [{ label: `Work: ${state.program === "none" ? "None selected" : programLabel(state.program)}`, clear: { program: "" } }] : []),
    ...(state.proposal ? [{ label: PROPOSAL_LABELS[state.proposal], clear: { proposal: "" } }] : []),
    ...(state.industry ? [{ label: `Industry: ${parseIndustry(state.industry)?.subsector ?? state.industry}`, clear: { industry: "" } }] : []),
    ...(state.community ? [{ label: `Community: ${state.community}`, clear: { community: "" } }] : []),
    ...(state.score ? [{ label: SCORE_LABELS[state.score], clear: { score: "" } }] : []),
    ...(state.contact ? [{ label: CONTACT_LABELS[state.contact], clear: { contact: "" } }] : []),
    ...(state.event ? [{ label: `Event: ${events.find((e) => e.id === state.event)?.title ?? "Selected"}`, clear: { event: "" } }] : []),
  ];

  const clearAll = () => go({ q: "", status: "", industry: "", community: "", score: "", contact: "", event: "", clientType: "", program: "", proposal: "" });

  async function exportAll() {
    setIsExporting(true);
    try {
      const statuses = state.status ? [state.status] : null;
      const rows: LeadRow[] = [];
      let total = 0;
      do {
        const batch = await exportLeadsBatch(state, { statuses, sort: state.sort, desc: state.desc, offset: rows.length });
        total = batch.total;
        rows.push(...batch.rows);
        if (batch.rows.length === 0) break;
      } while (rows.length < Math.min(total, EXPORT_CAP));

      downloadCsv("leads.csv", [
        ["Name", "Title", "Email", "Contacts", "Company", "Client type", "Work", "Industry", "Community", "Fit score", "Stage", "Proposal stage", "Added"],
        ...rows.map((r) => [r.primaryName, r.primaryTitle, r.primaryEmail, r.contactCount, r.companyName, clientTypeLabel(r.clientType), r.programs.map(programLabel).join("; "), r.industry, r.community, r.score, STATUS_LABELS[r.status], r.proposalStage ? DEAL_STAGE_META[r.proposalStage as DealStage].label : "", r.createdAt.slice(0, 10)]),
      ]);
      toast(total > EXPORT_CAP ? `Exported the first ${EXPORT_CAP.toLocaleString()} leads` : `Exported ${rows.length.toLocaleString()} leads`);
    } catch {
      toast("That export didn't finish. Please try again.", "error");
    }
    setIsExporting(false);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchField
          className="flex-1"
          label="Search leads"
          placeholder="Search by company, contact, title, or email..."
          value={search}
          onChange={onSearch}
          isLoading={isNavigating}
        />
        <button type="button" disabled={isExporting || matching === 0} onClick={() => void exportAll()} className={buttonClass("secondary")}>
          <Download className="h-4 w-4" strokeWidth={2} />
          {isExporting ? "Exporting..." : "Export"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect label="Stage" value={state.status} onChange={(status) => go({ status })} options={ALL_STATUSES.map((s) => ({ value: s as string, label: STATUS_LABELS[s], count: stages.find((x) => x.status === s)?.count ?? 0 }))} />
        <FilterSelect label="Client type" value={state.clientType} onChange={(clientType) => go({ clientType })} options={[...CLIENT_TYPES.map(([value, label]) => ({ value: value as string, label })), { value: "none", label: NOT_SET_LABEL }]} />
        <FilterSelect label="Work" value={state.program} onChange={(program) => go({ program })} options={[...LEAD_PROGRAMS.map(([value, label]) => ({ value: value as string, label })), { value: "none", label: "None selected" }]} />
        <FilterSelect label="Proposal" value={state.proposal} allLabel="Any" onChange={(proposal) => go({ proposal })} options={[{ value: "has", label: "Has a proposal" }, { value: "none", label: "No proposal" }]} />
        <FilterSelect label="Industry" value={state.industry} onChange={(industry) => go({ industry })} options={industryOptions(facets.industries)} />
        <FilterSelect label="Community" value={state.community} onChange={(community) => go({ community })} options={facets.communities.map((c) => ({ value: c, label: c }))} />
        <FilterSelect label="Fit" value={state.score} allLabel="Any" onChange={(score) => go({ score })} options={[{ value: "40", label: "Fit 40+" }, { value: "70", label: "Fit 70+" }]} />
        <FilterSelect label="Contact" value={state.contact} allLabel="Any" onChange={(contact) => go({ contact })} options={[{ value: "has_contact", label: "Has a contact" }, { value: "has_email", label: "Has an email" }, { value: "none", label: "No contact" }]} />
        {events.length > 0 && <FilterSelect label="Event" value={state.event} allLabel="Any" onChange={(event) => go({ event })} options={events.map((e) => ({ value: e.id, label: e.title }))} />}
      </div>

      <div className="mb-3 flex min-h-6 flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="font-medium text-slate-900">{matching.toLocaleString()} {matching === 1 ? "lead" : "leads"}</span>
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              if ("q" in chip.clear) setSearch("");
              go(chip.clear);
            }}
            className="inline-flex max-w-72 items-center gap-1 rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-medium text-slate-800 hover:bg-slate-300/70"
          >
            <span className="truncate">{chip.label}</span>
            <X className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-label="Remove filter" />
          </button>
        ))}
        {chips.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              clearAll();
            }}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className={`transition-opacity duration-150 ${isNavigating ? "opacity-60" : ""}`}>
        {table.total === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No leads match"
            description="Try a different search or remove a filter."
            action={chips.length > 0 ? <button type="button" onClick={() => { setSearch(""); clearAll(); }} className={buttonClass("secondary")}>Clear filters</button> : undefined}
          />
        ) : (
          <LeadsTable rows={table.rows} total={table.total} state={state} members={members} facets={facets} href={href} />
        )}
      </div>
    </div>
  );
}
