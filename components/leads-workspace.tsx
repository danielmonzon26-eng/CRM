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
  GripVertical,
  KanbanSquare,
  List,
  MoreHorizontal,
  Search,
  SearchX,
  User,
  X,
} from "lucide-react";
import { bulkChangeLeadProgram, bulkUpdateLeads, exportLeadsBatch, loadLeadsPage, updateLeadStatus } from "@/app/actions/leads";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/page";
import { formatMoney } from "@/lib/budgets/money";
import { downloadCsv } from "@/lib/csv";
import { CLIENT_TYPES, LEAD_PROGRAMS, clientTypeLabel, programLabel } from "@/lib/leads/classification";
import {
  ALL_STATUSES,
  BOARD_PAGE_SIZE,
  STATUS_LABELS,
  TABLE_PAGE_SIZE,
  leadViewToParams,
  type LeadSort,
  type LeadViewState,
} from "@/lib/leads/filters";
import type { BoardColumn, LeadFacets, LeadRow, StageSummary } from "@/lib/leads/search";
import type { LeadStatus } from "@/lib/supabase/types";
import { getInitials } from "@/lib/text";

const SELECT = "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const SEARCH_DELAY_MS = 250;
const EXPORT_CAP = 10000;

const STAGE_STYLES: Record<LeadStatus, { header: string; dot: string }> = {
  new: { header: "bg-sky-50 border-sky-100", dot: "bg-sky-600" },
  researching: { header: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-600" },
  contacted: { header: "bg-violet-50 border-violet-100", dot: "bg-violet-600" },
  qualified: { header: "bg-amber-50 border-amber-100", dot: "bg-amber-600" },
  won: { header: "bg-emerald-50 border-emerald-100", dot: "bg-emerald-600" },
  lost: { header: "bg-rose-50 border-rose-100", dot: "bg-rose-600" },
  unqualified: { header: "bg-slate-100 border-slate-200", dot: "bg-slate-500" },
};

const SCORE_LABELS: Record<string, string> = { "40": "Fit 40+", "70": "Fit 70+" };
const NOT_SET_LABEL = "Not set";
const CONTACT_LABELS: Record<string, string> = { has_contact: "Has a contact", has_email: "Has an email", none: "No contact" };

type Member = { id: string; name: string };

function FitBadge({ score }: { score: number }) {
  // A score of 0 means not scored yet, so it isn't shown as a rating.
  if (score <= 0) return null;
  const tone = score >= 70 ? "bg-emerald-50 text-emerald-800" : score >= 40 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span title="Fit score out of 100" className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>Fit {score}</span>;
}

const MAX_CARD_PROGRAMS = 2;

function ProgramChips({ programs, limit }: { programs: string[]; limit?: number }) {
  if (programs.length === 0) return null;
  const shown = limit ? programs.slice(0, limit) : programs;
  const hidden = programs.length - shown.length;
  return (
    <span title={programs.map(programLabel).join(", ")} className="flex flex-wrap gap-1">
      {shown.map((program) => (
        <span key={program} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800">{programLabel(program)}</span>
      ))}
      {hidden > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">+{hidden}</span>}
    </span>
  );
}

function OwnerAvatar({ name }: { name: string | null }) {
  if (!name) return <span className="text-[11px] text-slate-500">Unassigned</span>;
  return (
    <span title={`Owner: ${name}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 text-[10px] font-semibold text-white">
      {getInitials(name)}
    </span>
  );
}

function LeadCard({
  lead,
  ownerName,
  onDragStart,
  onDragEnd,
  onMove,
  statuses,
}: {
  lead: LeadRow;
  ownerName: string | null;
  onDragStart: (lead: LeadRow) => void;
  onDragEnd: () => void;
  onMove: (lead: LeadRow, status: LeadStatus) => void;
  statuses: LeadStatus[];
}) {
  const detail = [lead.industry, lead.community].filter(Boolean).join(" · ");
  const contact = lead.primaryName ? [lead.primaryName, lead.primaryTitle].filter(Boolean).join(", ") : null;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lead.id);
        // The whole card follows the pointer, even when the drag starts on its link.
        e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
        onDragStart(lead);
      }}
      onDragEnd={onDragEnd}
      className="group relative cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-card active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 font-medium leading-snug text-slate-900 after:absolute after:inset-0 after:rounded-lg hover:text-brand-700">
          <span className="line-clamp-2 text-sm">{lead.companyName}</span>
        </Link>
        <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
      </div>
      {(lead.clientType || detail) && (
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {lead.clientType && <span className="font-medium text-slate-700">{clientTypeLabel(lead.clientType)}</span>}
          {lead.clientType && detail ? " · " : ""}
          {detail}
        </p>
      )}
      <p className={`mt-2 flex items-center gap-1.5 truncate text-xs ${contact ? "text-slate-700" : "text-slate-500"}`}>
        <User className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
        <span className="truncate">{contact ?? "No contact yet"}</span>
        {lead.contactCount > 1 && <span className="shrink-0 text-slate-500">+{lead.contactCount - 1}</span>}
      </p>
      {lead.programs.length > 0 && (
        <div className="mt-2">
          <ProgramChips programs={lead.programs} limit={MAX_CARD_PROGRAMS} />
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <FitBadge score={lead.score} />
        <div className="relative z-10 ml-auto flex items-center gap-1.5">
          <OwnerAvatar name={ownerName} />
          {/* Dragging needs a mouse, so moving also works from the keyboard and on touch. */}
          <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100 focus-within:bg-slate-100">
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            <span className="sr-only">Move {lead.companyName} to another stage</span>
            <select
              value={lead.status}
              onChange={(e) => onMove(lead, e.target.value as LeadStatus)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {statuses.map((s) => <option key={s} value={s}>Move to {STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}

function Board({
  columns,
  state,
  memberName,
}: {
  columns: BoardColumn[];
  state: LeadViewState;
  memberName: (id: string | null) => string | null;
}) {
  const { toast } = useFeedback();
  const [local, setLocal] = useState(columns);
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const [overStatus, setOverStatus] = useState<LeadStatus | null>(null);
  const [loading, setLoading] = useState<LeadStatus | null>(null);

  useEffect(() => setLocal(columns), [columns]);

  async function move(lead: LeadRow, to: LeadStatus) {
    if (lead.status === to) return;
    const before = local;
    // Moves immediately, and puts the card back if saving fails.
    setLocal((current) =>
      current.map((column) => {
        if (column.status === lead.status) {
          return { ...column, count: column.count - 1, leads: column.leads.filter((l) => l.id !== lead.id) };
        }
        if (column.status === to) {
          return { ...column, count: column.count + 1, leads: [{ ...lead, status: to }, ...column.leads] };
        }
        return column;
      })
    );
    try {
      await updateLeadStatus(lead.id, to);
      toast(`${lead.companyName} moved to ${STATUS_LABELS[to]}`);
    } catch {
      setLocal(before);
      toast(`${lead.companyName} didn't move. Please try again.`, "error");
    }
  }

  async function loadMore(column: BoardColumn) {
    setLoading(column.status);
    try {
      const rows = await loadLeadsPage(state, { status: column.status, sort: state.sort, desc: state.desc, offset: column.leads.length, limit: BOARD_PAGE_SIZE });
      setLocal((current) =>
        current.map((c) => {
          if (c.status !== column.status) return c;
          const seen = new Set(c.leads.map((l) => l.id));
          return { ...c, leads: [...c.leads, ...rows.filter((r) => !seen.has(r.id))] };
        })
      );
    } catch {
      toast("More leads couldn't load. Please try again.", "error");
    }
    setLoading(null);
  }

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3">
        {local.map((column) => {
          const style = STAGE_STYLES[column.status];
          const isTarget = overStatus === column.status && dragging?.status !== column.status;
          return (
            <section
              key={column.status}
              aria-label={`${STATUS_LABELS[column.status]}, ${column.count} leads`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverStatus(column.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) void move(dragging, column.status);
                setDragging(null);
                setOverStatus(null);
              }}
              className={`flex min-w-0 flex-col rounded-xl border bg-slate-50/70 transition-colors ${isTarget ? "border-brand-400 bg-brand-50/60" : "border-slate-200"}`}
            >
              <header className={`rounded-t-xl border-b px-3 py-2.5 ${style.header}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                    {STATUS_LABELS[column.status]}
                  </h2>
                  <span className="text-sm font-medium tabular-nums text-slate-700">{column.count.toLocaleString()}</span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-slate-600">{formatMoney(column.openValue)} open</p>
              </header>
              <div className="flex max-h-[calc(100vh-20rem)] min-h-40 flex-col gap-2 overflow-y-auto p-2">
                {column.leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    ownerName={memberName(lead.assignedTo)}
                    onDragStart={setDragging}
                    onDragEnd={() => {
                      setDragging(null);
                      setOverStatus(null);
                    }}
                    onMove={(l, to) => void move(l, to)}
                    statuses={ALL_STATUSES}
                  />
                ))}
                {column.leads.length === 0 && <p className="px-2 py-8 text-center text-xs text-slate-500">{isTarget ? "Drop here" : "No leads"}</p>}
                {column.leads.length < column.count && (
                  <button type="button" disabled={loading === column.status} onClick={() => void loadMore(column)} className={`${buttonClass("ghost", "sm")} w-full`}>
                    {loading === column.status ? "Loading..." : `Show more (${(column.count - column.leads.length).toLocaleString()} left)`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
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
    <th scope="col" aria-sort={active ? (state.desc ? "descending" : "ascending") : "none"} className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
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
  memberName,
  href,
}: {
  rows: LeadRow[];
  total: number;
  state: LeadViewState;
  members: Member[];
  memberName: (id: string | null) => string | null;
  href: (patch: Partial<LeadViewState>) => string;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => setSelected(new Set()), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const start = total === 0 ? 0 : (state.page - 1) * TABLE_PAGE_SIZE + 1;
  const end = Math.min(state.page * TABLE_PAGE_SIZE, total);
  const lastPage = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE));

  function apply(change: { status?: LeadStatus; assigneeId?: string | null; clientType?: string | null }, description: string) {
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
            aria-label="Move selected leads to a stage"
            disabled={isPending}
            value=""
            onChange={(e) => e.target.value && apply({ status: e.target.value as LeadStatus }, `moved to ${STATUS_LABELS[e.target.value as LeadStatus]}`)}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Move to stage...</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select
            aria-label="Assign selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const id = e.target.value === "none" ? null : e.target.value;
              apply({ assigneeId: id }, id ? `assigned to ${members.find((m) => m.id === id)?.name}` : "unassigned");
            }}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Assign to...</option>
            <option value="none">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            aria-label="Add or remove a program on selected leads"
            disabled={isPending}
            value=""
            onChange={(e) => e.target.value && changeProgram(e.target.value)}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white [&>option]:text-slate-900"
          >
            <option value="">Change programs...</option>
            <optgroup label="Add program">
              {LEAD_PROGRAMS.map(([value, label]) => <option key={value} value={`+${value}`}>Add {label}</option>)}
            </optgroup>
            <optgroup label="Remove program">
              {LEAD_PROGRAMS.map(([value, label]) => <option key={value} value={`-${value}`}>Remove {label}</option>)}
            </optgroup>
          </select>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-ink-200 hover:text-white">Clear</button>
        </div>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[1240px] text-left text-sm">
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
              <SortHeader label="Company" sort="name" state={state} href={href} />
              <SortHeader label="Client type" sort="client_type" state={state} href={href} />
              <th scope="col" className="px-3 py-2.5 font-medium">Programs</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Contact</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Industry</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Community</th>
              <SortHeader label="Fit" sort="score" state={state} href={href} />
              <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
              <SortHeader label="Stage" sort="status" state={state} href={href} />
              <SortHeader label="Added" sort="created" state={state} href={href} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((lead) => (
              <tr key={lead.id} className={`transition-colors hover:bg-slate-50 ${selected.has(lead.id) ? "bg-brand-50/50" : ""}`}>
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
                <td className="max-w-72 px-3 py-2.5">
                  <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">{lead.companyName}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{clientTypeLabel(lead.clientType) ?? <span className="text-slate-500">—</span>}</td>
                <td className="max-w-64 px-3 py-2.5">{lead.programs.length ? <ProgramChips programs={lead.programs} /> : <span className="text-slate-500">—</span>}</td>
                <td className="max-w-60 px-3 py-2.5 text-slate-700">
                  {lead.primaryName ? (
                    <>
                      <span className="block truncate">{lead.primaryName}{lead.contactCount > 1 ? ` +${lead.contactCount - 1}` : ""}</span>
                      {(lead.primaryTitle || lead.primaryEmail) && <span className="block truncate text-xs text-slate-500">{lead.primaryTitle ?? lead.primaryEmail}</span>}
                    </>
                  ) : (
                    <span className="text-slate-500">None yet</span>
                  )}
                </td>
                <td className="max-w-48 truncate px-3 py-2.5 text-slate-600">{lead.industry ?? "—"}</td>
                <td className="max-w-40 truncate px-3 py-2.5 text-slate-600">{lead.community ?? "—"}</td>
                <td className="px-3 py-2.5">{lead.score > 0 ? <FitBadge score={lead.score} /> : <span className="text-slate-500">—</span>}</td>
                <td className="max-w-36 truncate px-3 py-2.5 text-slate-600">{memberName(lead.assignedTo) ?? <span className="text-slate-500">Unassigned</span>}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${STAGE_STYLES[lead.status].dot}`} />
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{lead.createdAt.slice(0, 10)}</td>
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
    </div>
  );
}

export function LeadsWorkspace({
  state,
  defaultView,
  basePath,
  board,
  table,
  stages,
  facets,
  members,
  events,
}: {
  state: LeadViewState;
  defaultView: "board" | "table";
  basePath: string;
  board: BoardColumn[] | null;
  table: { rows: LeadRow[]; total: number } | null;
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
    const query = leadViewToParams({ ...state, ...patch }, defaultView).toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const go = (patch: Partial<LeadViewState>) => startNavigation(() => router.replace(href({ page: 1, ...patch }), { scroll: false }));

  useEffect(() => setSearch(state.q), [state.q]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function onSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => go({ q: value.trim() }), SEARCH_DELAY_MS);
  }

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? "Unknown" : null);
  const matching = state.status
    ? stages.find((s) => s.status === state.status)?.count ?? 0
    : stages.reduce((total, s) => total + s.count, 0);

  const chips: { label: string; clear: Partial<LeadViewState> }[] = [
    ...(state.q ? [{ label: `Search: ${state.q}`, clear: { q: "" } }] : []),
    ...(state.status ? [{ label: `Stage: ${STATUS_LABELS[state.status as LeadStatus]}`, clear: { status: "" } }] : []),
    ...(state.clientType ? [{ label: `Client type: ${state.clientType === "none" ? NOT_SET_LABEL : clientTypeLabel(state.clientType)}`, clear: { clientType: "" } }] : []),
    ...(state.program ? [{ label: `Program: ${state.program === "none" ? "None selected" : programLabel(state.program)}`, clear: { program: "" } }] : []),
    ...(state.owner ? [{ label: `Owner: ${state.owner === "unassigned" ? "Unassigned" : memberName(state.owner)}`, clear: { owner: "" } }] : []),
    ...(state.industry ? [{ label: `Industry: ${state.industry}`, clear: { industry: "" } }] : []),
    ...(state.community ? [{ label: `Community: ${state.community}`, clear: { community: "" } }] : []),
    ...(state.score ? [{ label: SCORE_LABELS[state.score], clear: { score: "" } }] : []),
    ...(state.contact ? [{ label: CONTACT_LABELS[state.contact], clear: { contact: "" } }] : []),
    ...(state.event ? [{ label: `Event: ${events.find((e) => e.id === state.event)?.title ?? "Selected"}`, clear: { event: "" } }] : []),
  ];

  const clearAll = () => go({ q: "", status: "", owner: "", industry: "", community: "", score: "", contact: "", event: "", clientType: "", program: "" });

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
        ["Company", "Client type", "Programs", "Contact", "Title", "Email", "Contacts", "Industry", "Community", "Fit score", "Owner", "Stage", "Added"],
        ...rows.map((r) => [r.companyName, clientTypeLabel(r.clientType), r.programs.map(programLabel).join("; "), r.primaryName, r.primaryTitle, r.primaryEmail, r.contactCount, r.industry, r.community, r.score, memberName(r.assignedTo), STATUS_LABELS[r.status], r.createdAt.slice(0, 10)]),
      ]);
      toast(total > EXPORT_CAP ? `Exported the first ${EXPORT_CAP.toLocaleString()} leads` : `Exported ${rows.length.toLocaleString()} leads`);
    } catch {
      toast("That export didn't finish. Please try again.", "error");
    }
    setIsExporting(false);
  }

  const noResults = state.view === "board" ? matching === 0 : table?.total === 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            aria-label="Search leads"
            placeholder="Search by company, contact, title, or email..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className={`${SELECT} w-full pl-9 pr-8`}
          />
          {isNavigating && <span aria-hidden="true" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />}
        </div>
        <div role="group" aria-label="View" className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([["board", "Board", KanbanSquare], ["table", "Table", List]] as const).map(([view, label, Icon]) => (
            <button
              key={view}
              type="button"
              aria-pressed={state.view === view}
              onClick={() => go({ view })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${state.view === view ? "bg-brand-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
        <button type="button" disabled={isExporting || matching === 0} onClick={() => void exportAll()} className={buttonClass("secondary")}>
          <Download className="h-4 w-4" strokeWidth={2} />
          {isExporting ? "Exporting..." : "Export"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Stage" value={state.status} onChange={(e) => go({ status: e.target.value })} className={SELECT}>
          <option value="">Stage: All</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]} ({(stages.find((x) => x.status === s)?.count ?? 0).toLocaleString()})</option>
          ))}
        </select>
        <select aria-label="Client type" value={state.clientType} onChange={(e) => go({ clientType: e.target.value })} className={SELECT}>
          <option value="">Client type: All</option>
          {CLIENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="none">{NOT_SET_LABEL}</option>
        </select>
        <select aria-label="Program" value={state.program} onChange={(e) => go({ program: e.target.value })} className={`${SELECT} max-w-56`}>
          <option value="">Program: All</option>
          {LEAD_PROGRAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="none">None selected</option>
        </select>
        <select aria-label="Owner" value={state.owner} onChange={(e) => go({ owner: e.target.value })} className={SELECT}>
          <option value="">Owner: Anyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Industry" value={state.industry} onChange={(e) => go({ industry: e.target.value })} className={`${SELECT} max-w-52`}>
          <option value="">Industry: All</option>
          {facets.industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select aria-label="Community" value={state.community} onChange={(e) => go({ community: e.target.value })} className={`${SELECT} max-w-52`}>
          <option value="">Community: All</option>
          {facets.communities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Fit score" value={state.score} onChange={(e) => go({ score: e.target.value })} className={SELECT}>
          <option value="">Fit: Any</option>
          <option value="40">Fit 40+</option>
          <option value="70">Fit 70+</option>
        </select>
        <select aria-label="Contact" value={state.contact} onChange={(e) => go({ contact: e.target.value })} className={SELECT}>
          <option value="">Contact: Any</option>
          <option value="has_contact">Has a contact</option>
          <option value="has_email">Has an email</option>
          <option value="none">No contact</option>
        </select>
        {events.length > 0 && (
          <select aria-label="Registered for event" value={state.event} onChange={(e) => go({ event: e.target.value })} className={`${SELECT} max-w-56`}>
            <option value="">Event: Any</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}
        {state.view === "board" && (
          <>
            <select
              aria-label="Sort cards by"
              value={`${state.sort}:${state.desc ? "desc" : "asc"}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(":");
                go({ sort: sort as LeadSort, desc: dir === "desc" });
              }}
              className={SELECT}
            >
              <option value="score:desc">Sort: Best fit</option>
              <option value="created:desc">Sort: Newest</option>
              <option value="name:asc">Sort: Name A–Z</option>
            </select>
            {!state.status && (
              <label className="flex items-center gap-1.5 px-1 text-sm text-slate-700">
                <input type="checkbox" checked={state.unqualified} onChange={(e) => go({ unqualified: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                Show unqualified
              </label>
            )}
          </>
        )}
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
        {noResults ? (
          <EmptyState
            icon={SearchX}
            title="No leads match"
            description="Try a different search or remove a filter."
            action={chips.length > 0 ? <button type="button" onClick={() => { setSearch(""); clearAll(); }} className={buttonClass("secondary")}>Clear filters</button> : undefined}
          />
        ) : state.view === "board" && board ? (
          <Board columns={board} state={state} memberName={memberName} />
        ) : table ? (
          <LeadsTable rows={table.rows} total={table.total} state={state} members={members} memberName={memberName} href={href} />
        ) : null}
      </div>
    </div>
  );
}
