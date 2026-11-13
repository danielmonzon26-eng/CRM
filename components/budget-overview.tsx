"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, CalendarRange, CheckCircle2, ChevronDown, Download, Link2Off, Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { addBudgetLine, addBudgetQuarter, deleteEmptyBudget, renameBudget, setBudgetTotal, setLineMonth } from "@/app/actions/budgets";
import { BudgetHistory } from "@/components/budget-history";
import { EditableMoney } from "@/components/budget-editable";
import { BudgetLineRows, UsedBar, type EventOption } from "@/components/budget-line-rows";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { Gauge } from "@/components/ui/gauge";
import { EmptyState } from "@/components/ui/page";
import { monthLabel } from "@/lib/budgets/history";
import { addCents, formatMoney, fromCents, sumMoney } from "@/lib/budgets/money";
import { monthsToAddForNextQuarter, quarterLabel, quarterOf } from "@/lib/budgets/quarters";
import type { BudgetChangeRow, BudgetOverview, LineSummary } from "@/lib/budgets/queries";
import { downloadCsv } from "@/lib/csv";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";
const SELECT = "rounded-lg border border-[#8493a8] bg-white px-2.5 py-2 text-sm text-slate-700";
const SPENT_COLOR = "#0D9488";
const COMMITTED_COLOR = "#2563EB";
const REMAINING_COLOR = "#CBD5E1";

type Status = "" | "over" | "near" | "unspent" | "unlinked";
type PeriodRow = LineSummary & { periodPlan: number; periodCommitted: number; periodActual: number; periodRemaining: number };

export function AddLineForm({ budget, sections, onClose, stayOnPage = false }: { budget: BudgetOverview; sections: string[]; onClose: () => void; stayOnPage?: boolean }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<"general" | "event">("general");
  const [name, setName] = useState("");
  const [section, setSection] = useState(sections[0] ?? "");
  const [planMonth, setPlanMonth] = useState(budget.months[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={`${CARD} animate-pop grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] xl:items-end`}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addBudgetLine({ budgetId: budget.id, kind, section, name, planMonth: kind === "event" ? planMonth : null });
          if (result.error) {
            setError(result.error);
            return;
          }
          toast(`Added "${name.trim()}"`);
          if (stayOnPage) onClose();
          else router.push(`/budgets/lines/${result.id}`);
        });
      }}
    >
      <label className="text-xs font-medium text-slate-600">
        Line name
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={`${SELECT} mt-1 w-full`} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Section
        <input required list="budget-sections" value={section} onChange={(e) => setSection(e.target.value)} className={`${SELECT} mt-1 w-full`} />
        <datalist id="budget-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`${SELECT} mt-1 w-full`}>
          <option value="general">General, by quarter</option>
          <option value="event">Event, by item</option>
        </select>
      </label>
      {kind === "event" ? (
        <label className="text-xs font-medium text-slate-600">
          Planned in
          <select value={planMonth} onChange={(e) => setPlanMonth(e.target.value)} className={`${SELECT} mt-1 w-full`}>
            {budget.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      ) : (
        <span className="hidden xl:block" />
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={buttonClass("primary")}>{isPending ? "Adding..." : "Add line"}</button>
        <button type="button" onClick={onClose} className={buttonClass("ghost")}>Cancel</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2 xl:col-span-5">{error}</p>}
    </form>
  );
}

function SpendBar({ actual, committed, plan }: { actual: number; committed: number; plan: number }) {
  // Over budget, the bar is scaled to the spending so its parts still fit.
  const scale = Math.max(plan, actual + committed, 1);
  const parts = [
    { label: "Spent", value: actual, color: SPENT_COLOR },
    { label: "Committed", value: committed, color: COMMITTED_COLOR },
  ];
  return (
    <div className="h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: REMAINING_COLOR }}>
      <div className="flex h-full">
        {parts.map((part) => (
          <div key={part.label} title={`${part.label}: ${formatMoney(part.value)}`} style={{ width: `${(part.value / scale) * 100}%`, backgroundColor: part.color }} />
        ))}
      </div>
    </div>
  );
}

/** Inline editor for the budget's overall total. */
export function TotalField({ budget }: { budget: BudgetOverview }) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget.total === null ? "" : String(budget.total));
  const [isPending, startTransition] = useTransition();
  function save(next: string) {
    startTransition(async () => {
      const result = await setBudgetTotal(budget.id, next);
      if (result.error) toast(result.error, "error");
      else {
        toast("Total budget saved");
        setEditing(false);
      }
    });
  }
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="group inline-flex items-center gap-1.5 text-left" aria-label="Change the total budget">
        <span className={`text-3xl font-bold tabular-nums tracking-tight ${budget.total === null ? "text-slate-400" : "text-slate-900"}`}>
          {budget.total === null ? "Not set" : formatMoney(budget.total)}
        </span>
        <Pencil className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700" strokeWidth={2} />
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <span className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">$</span>
        <input
          autoFocus
          aria-label="Total budget"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="15000"
          className="w-36 rounded-lg border border-slate-300 py-1.5 pl-6 pr-2 text-right text-base font-semibold tabular-nums focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </span>
      <button type="submit" disabled={isPending} className={buttonClass("primary", "sm")}>Save</button>
      <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>Cancel</button>
      {budget.total === null && budget.approved > 0 && (
        <button type="button" onClick={() => save(String(budget.approved))} className="text-xs font-medium text-brand-700 hover:underline">
          Use {formatMoney(budget.approved)} (what&apos;s allocated)
        </button>
      )}
    </form>
  );
}

/**
 * The dashboard's gauges: how much of the total is allocated to lines, and how much of what's
 * allocated is committed and spent. Below them, the money in figures.
 */
function BudgetGauges({
  budget,
  period,
  periodName,
}: {
  budget: BudgetOverview;
  period: { plan: number; committed: number; actual: number; remaining: number; percent: number };
  periodName: string | null;
}) {
  const allocated = budget.approved;
  const total = budget.total;
  const allocatedPct = total && total > 0 ? Math.round((allocated / total) * 100) : total === 0 && allocated > 0 ? 101 : null;
  const unallocated = total === null ? null : fromCents(addCents([total]) - addCents([allocated]));
  const paidPct = period.plan > 0 ? Math.round((period.actual / period.plan) * 100) : period.actual > 0 ? 101 : 0;
  const scope = periodName ? ` · ${periodName}` : "";
  const figures: { label: string; value: React.ReactNode; tone?: string }[] = [
    { label: "Total budget", value: <TotalField budget={budget} /> },
    { label: "Allocated", value: formatMoney(allocated) },
    {
      label: unallocated !== null && unallocated < 0 ? "Over-allocated" : "Unallocated",
      value: unallocated === null ? "—" : formatMoney(Math.abs(unallocated)),
      tone: unallocated === null ? "text-slate-400" : unallocated < 0 ? "text-rose-700" : "text-emerald-700",
    },
    { label: `Committed${scope}`, value: formatMoney(period.committed) },
    { label: `Spent${scope}`, value: formatMoney(period.actual) },
    {
      label: period.remaining < 0 ? `Over budget${scope}` : `Left to spend${scope}`,
      value: formatMoney(Math.abs(period.remaining)),
      tone: period.remaining < 0 ? "text-rose-700" : "text-slate-900",
    },
  ];
  return (
    <div>
      <div className="grid gap-6 rounded-xl bg-slate-50/80 p-5 sm:grid-cols-3">
        <Gauge percent={allocatedPct} label="Allocated" tone={allocatedPct === null ? undefined : allocatedPct > 100 ? "#e11d48" : "#ff6729"}>
          {total === null
            ? "Set the total budget to see this"
            : `${formatMoney(allocated)} of ${formatMoney(total)}${unallocated !== null && unallocated < 0 ? ` · over by ${formatMoney(-unallocated)}` : ""}`}
        </Gauge>
        <Gauge percent={period.percent} label="Committed and spent">
          {formatMoney(period.committed + period.actual)} of {formatMoney(period.plan)} allocated{scope}
        </Gauge>
        <Gauge percent={paidPct} label="Spent" tone={paidPct > 100 ? "#e11d48" : "#0d9488"}>
          {formatMoney(period.actual)} paid of {formatMoney(period.plan)}{scope}
        </Gauge>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</dt>
            <dd className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${f.tone ?? "text-slate-900"}`}>{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <SpendBar actual={period.actual} committed={period.committed} plan={period.plan} />
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SPENT_COLOR }} />Spent</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COMMITTED_COLOR }} />Committed</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REMAINING_COLOR }} />Left to spend</span>
        </div>
      </div>
    </div>
  );
}

function rangeLabel(months: string[]): string {
  if (months.length === 0) return "No months";
  const first = monthLabel(months[0]);
  const last = monthLabel(months[months.length - 1]);
  const span = `${months.length} month${months.length === 1 ? "" : "s"}`;
  return months.length === 1 ? `${first} · 1 month` : `${first} – ${last} · ${span}`;
}

export function BudgetOverviewView({ budget, changes, events }: { budget: BudgetOverview; changes: BudgetChangeRow[]; events: EventOption[] }) {
  const router = useRouter();
  const { toast, confirm, promptText } = useFeedback();
  const addRef = useRef<HTMLButtonElement>(null);
  const firstMonth = budget.months[0] ?? "";
  const lastMonth = budget.months[budget.months.length - 1] ?? "";
  const [from, setFrom] = useState(firstMonth);
  const [to, setTo] = useState(lastMonth);
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const quarters = useMemo(() => [...new Set(budget.months.map(quarterOf))], [budget.months]);
  const sections = useMemo(() => [...new Set(budget.lines.map((l) => l.section))], [budget.lines]);

  const isAll = from === firstMonth && to === lastMonth;
  const periodMonths = useMemo(() => budget.months.filter((m) => m >= from && m <= to), [budget.months, from, to]);

  function setRange(start: string, end: string) {
    // Keeps the range the right way round whichever end was changed.
    setFrom(start <= end ? start : end);
    setTo(start <= end ? end : start);
  }

  // Every line's figures for the chosen months, before the search and filters.
  const periodLines = useMemo<PeriodRow[]>(
    () =>
      budget.lines.map((line) => {
        const periodPlan = sumMoney(periodMonths.map((m) => line.months[m] ?? 0));
        // The full range also counts spending dated outside the budget's months, so nothing is hidden.
        const spent = isAll ? { committed: line.committed, actual: line.actual } : {
          committed: sumMoney(periodMonths.map((m) => line.spentByMonth[m]?.committed ?? 0)),
          actual: sumMoney(periodMonths.map((m) => line.spentByMonth[m]?.actual ?? 0)),
        };
        return {
          ...line,
          periodPlan,
          periodCommitted: spent.committed,
          periodActual: spent.actual,
          periodRemaining: fromCents(addCents([periodPlan]) - addCents([spent.committed, spent.actual])),
        };
      }),
    [budget.lines, periodMonths, isAll]
  );

  const inPeriod = (line: PeriodRow) => isAll || line.periodPlan !== 0 || line.periodCommitted + line.periodActual !== 0;
  const isOver = (line: PeriodRow) => line.periodRemaining < 0;
  const isNear = (line: PeriodRow) => {
    const used = line.periodPlan > 0 ? (line.periodCommitted + line.periodActual) / line.periodPlan : 0;
    return used >= 0.9 && line.periodRemaining >= 0;
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodLines.filter((line) => {
      if (section && line.section !== section) return false;
      if (kind && line.kind !== kind) return false;
      if (query && ![line.name, line.section, line.eventTitle, line.ownerName].some((v) => v?.toLowerCase().includes(query))) return false;
      if (status === "over" && !isOver(line)) return false;
      if (status === "near" && !isNear(line)) return false;
      if (status === "unspent" && line.periodCommitted + line.periodActual > 0) return false;
      if (status === "unlinked" && (line.kind !== "event" || line.eventId)) return false;
      // A narrower range skips lines with nothing planned or spent in it, unless searching.
      if (!query && !inPeriod(line)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodLines, section, kind, status, search, isAll]);

  const sum = (lines: PeriodRow[]) => {
    const plan = sumMoney(lines.map((r) => r.periodPlan));
    const committed = sumMoney(lines.map((r) => r.periodCommitted));
    const actual = sumMoney(lines.map((r) => r.periodActual));
    const remaining = fromCents(addCents([plan]) - addCents([committed, actual]));
    const percent = plan > 0 ? Math.round(((committed + actual) / plan) * 100) : committed + actual > 0 ? 100 : 0;
    return { plan, committed, actual, remaining, percent };
  };

  // The summary and section cards show the whole range; the table follows the filters too.
  const periodTotals = useMemo(() => sum(periodLines.filter(inPeriod)), [periodLines]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => sum(rows), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const overCount = periodLines.filter((l) => inPeriod(l) && isOver(l)).length;
  const nearCount = periodLines.filter((l) => inPeriod(l) && isNear(l)).length;
  const unlinkedCount = periodLines.filter((l) => inPeriod(l) && l.kind === "event" && !l.eventId).length;
  const sectionCards = sections
    .map((name) => ({ name, lineCount: periodLines.filter((l) => l.section === name && inPeriod(l)).length, ...sum(periodLines.filter((l) => l.section === name && inPeriod(l))) }))
    .filter((s) => s.lineCount > 0);

  const visibleSections = sections.filter((s) => rows.some((r) => r.section === s));
  const hasFilters = Boolean(section || kind || status || search);
  const periodName = isAll ? "All months" : rangeLabel(periodMonths).split(" · ")[0];
  const quartersInView = new Set(periodMonths.map(quarterOf));
  const rowMonths = budget.months.filter((m) => quartersInView.has(quarterOf(m)));
  const following = budget.months.length ? monthsToAddForNextQuarter(lastMonth) : null;

  function clearFilters() {
    setSection("");
    setKind("");
    setStatus("");
    setSearch("");
  }

  function exportCsv() {
    downloadCsv(`${budget.name} ${periodName}.csv`, [
      ["Section", "Line", "Linked event", "Period budget", ...periodMonths.map(monthLabel), "Committed", "Actual", "Remaining", "Notes"],
      ...rows.map((l) => [l.section, l.name, l.eventTitle, l.periodPlan, ...periodMonths.map((m) => l.months[m] ?? 0), l.periodCommitted, l.periodActual, l.periodRemaining, l.notes]),
    ]);
  }

  async function addQuarter() {
    if (!following) return;
    const label = quarterLabel(following.quarter);
    const yes = await confirm({
      title: `Add ${label} to this budget?`,
      body: "Every line gets $0 for its months, which you can then fill in.",
      confirmLabel: "Add quarter",
    });
    if (!yes) return;
    startTransition(async () => {
      const result = await addBudgetQuarter(budget.id, following.months);
      toast(result.error ?? `Added ${label}`, result.error ? "error" : "success");
    });
  }

  async function removeEmptyBudget() {
    const yes = await confirm({ title: `Delete "${budget.name}"?`, body: "This budget has no lines or revenue, so nothing else is lost.", confirmLabel: "Delete budget", danger: true });
    if (!yes) return;
    startTransition(async () => {
      const result = await deleteEmptyBudget(budget.id);
      toast(result.error ?? "Budget deleted", result.error ? "error" : "success");
      if (!result.error) router.refresh();
    });
  }

  async function rename() {
    const name = await promptText({ title: "Rename this budget", label: "Budget name" });
    if (!name) return;
    startTransition(async () => {
      const result = await renameBudget(budget.id, name);
      toast(result.error ?? "Budget renamed", result.error ? "error" : "success");
    });
  }

  const presets: [string, string, string][] = [
    ["All months", firstMonth, lastMonth],
    ...quarters.map((q): [string, string, string] => {
      const months = budget.months.filter((m) => quarterOf(m) === q);
      return [quarterLabel(q), months[0], months[months.length - 1]];
    }),
  ];

  return (
    <div className="space-y-6">
      {/* Date range */}
      <section aria-label="Date range" className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <CalendarRange className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Showing</p>
            <p className="font-semibold text-slate-900">{rangeLabel(periodMonths)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            From
            <select aria-label="From month" value={from} onChange={(e) => setRange(e.target.value, to)} className={`${SELECT} mt-1 block w-36`}>
              {budget.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <span className="pb-2.5 text-slate-400">–</span>
          <label className="text-xs font-medium text-slate-600">
            To
            <select aria-label="To month" value={to} onChange={(e) => setRange(from, e.target.value)} className={`${SELECT} mt-1 block w-36`}>
              {budget.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
        </div>
        <div role="group" aria-label="Quick ranges" className="flex flex-wrap gap-1.5">
          {presets.map(([label, start, end]) => {
            const active = from === start && to === end;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(start, end)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button type="button" disabled={isPending || !following} onClick={addQuarter} className={`${buttonClass("ghost", "sm")} ml-auto`}>
          <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
          {following ? `Add ${quarterLabel(following.quarter)}` : "Add quarter"}
        </button>
      </section>

      {budget.lines.length > 0 && (
        <>
          {/* Summary */}
          <section aria-label={`Summary for ${periodName}`} className={`${CARD} p-5 sm:p-6`}>
            <BudgetGauges budget={budget} period={periodTotals} periodName={isAll ? null : periodName} />
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {overCount + nearCount + unlinkedCount === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  Everything is within budget for {isAll ? "this budget" : periodName}.
                </p>
              ) : (
                <>
                  {overCount > 0 && (
                    <button type="button" onClick={() => setStatus("over")} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100">
                      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                      {overCount} line{overCount === 1 ? "" : "s"} over budget
                    </button>
                  )}
                  {nearCount > 0 && (
                    <button type="button" onClick={() => setStatus("near")} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100">
                      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                      {nearCount} near the limit
                    </button>
                  )}
                  {unlinkedCount > 0 && (
                    <button type="button" onClick={() => setStatus("unlinked")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                      <Link2Off className="h-4 w-4" strokeWidth={2} />
                      {unlinkedCount} event line{unlinkedCount === 1 ? "" : "s"} not linked to an event
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Sections */}
          {sectionCards.length > 1 && (
            <section aria-label="Sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sectionCards.map((s) => {
                const active = section === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSection(active ? "" : s.name)}
                    className={`${CARD} p-4 text-left transition-colors hover:border-slate-300 ${active ? "ring-2 ring-brand-500" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900">{s.name}</p>
                      <p className="shrink-0 text-xs text-slate-500">{s.lineCount} line{s.lineCount === 1 ? "" : "s"}</p>
                    </div>
                    <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(s.plan)}</p>
                    <div className="mt-3">
                      <SpendBar actual={s.actual} committed={s.committed} plan={s.plan} />
                    </div>
                    <p className={`mt-2 text-xs ${s.remaining < 0 ? "font-medium text-rose-700" : "text-slate-500"}`}>
                      {s.remaining < 0 ? `${formatMoney(-s.remaining)} over` : `${formatMoney(s.remaining)} left`} · {s.percent}% used
                    </p>
                  </button>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* Lines */}
      <section aria-label="Budget lines" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Budget lines
            <span className="ml-2 text-sm font-normal text-slate-500">{rows.length} of {periodLines.filter(inPeriod).length}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={rename} disabled={isPending} className={buttonClass("secondary")}>
              <Pencil className="h-4 w-4" strokeWidth={2} />
              Rename
            </button>
            {budget.lines.length === 0 && (
              <button type="button" onClick={removeEmptyBudget} disabled={isPending} className={buttonClass("secondary")}>
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Delete
              </button>
            )}
            <button type="button" onClick={exportCsv} disabled={rows.length === 0} className={buttonClass("secondary")}>
              <Download className="h-4 w-4" strokeWidth={2} />
              Export
            </button>
            <button ref={addRef} type="button" onClick={() => setIsAdding(true)} className={buttonClass("primary")}>
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Add line
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField className="flex-1" label="Search budget lines" placeholder="Search lines, sections, or events..." value={search} onChange={setSearch} />
          <FilterSelect label="Section" value={section} onChange={setSection} options={sections.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Type" value={kind} onChange={setKind} options={[{ value: "general", label: "General" }, { value: "event", label: "Event" }]} />
          <FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as Status)} options={[{ value: "over", label: "Over budget" }, { value: "near", label: "90% or more used" }, { value: "unspent", label: "No spending yet" }, { value: "unlinked", label: "Event not linked" }]} />
          {hasFilters && (
            <button type="button" onClick={clearFilters} className={buttonClass("ghost", "sm")}>
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Clear filters
            </button>
          )}
        </div>

        {isAdding && (
          <AddLineForm
            budget={budget}
            sections={sections}
            onClose={() => {
              setIsAdding(false);
              addRef.current?.focus();
            }}
          />
        )}

        {budget.lines.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="This budget has no lines yet"
            description="Add a line for each cost, such as ads or an event. You'll plan it by quarter or by item."
            action={!isAdding ? <button type="button" onClick={() => setIsAdding(true)} className={buttonClass("primary")}>Add the first line</button> : undefined}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title="No budget lines match" description={`Nothing is planned or spent for these filters in ${periodName}.`} action={hasFilters ? <button type="button" onClick={clearFilters} className={buttonClass("secondary")}>Clear filters</button> : undefined} />
        ) : (
          <div className={CARD}>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Line</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Budget</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Committed</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Spent</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Remaining</th>
                    <th scope="col" className="px-3 py-3 font-medium">Used</th>
                    <th scope="col" className="w-20 px-3 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                {visibleSections.map((name) => {
                  const lines = rows.filter((l) => l.section === name);
                  const sub = sum(lines);
                  return (
                    <tbody key={name}>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <th scope="rowgroup" className="px-5 py-2.5 text-left text-sm font-semibold text-slate-800">{name}</th>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">{formatMoney(sub.plan)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">{formatMoney(sub.committed)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">{formatMoney(sub.actual)}</td>
                        <td className={`px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${sub.remaining < 0 ? "text-rose-700" : "text-slate-700"}`}>{formatMoney(sub.remaining)}</td>
                        <td className="px-3 py-2.5"><UsedBar plan={sub.plan} spent={sub.committed + sub.actual} /></td>
                        <td />
                      </tr>
                      {lines.map((line) => (
                        <BudgetLineRows
                          key={line.id}
                          line={line}
                          items={budget.itemsByLine[line.id] ?? []}
                          months={rowMonths}
                          events={events}
                          filtered={!isAll}
                          showUsed
                          figures={{ plan: line.periodPlan, committed: line.periodCommitted, actual: line.periodActual, remaining: line.periodRemaining }}
                        />
                      ))}
                    </tbody>
                  );
                })}
                <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                  <tr>
                    <td className="px-5 py-3">Total{hasFilters ? " (filtered)" : ""}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.plan)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.committed)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.actual)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${totals.remaining < 0 ? "text-rose-700" : ""}`}>{formatMoney(totals.remaining)}</td>
                    <td className="px-3 py-3"><UsedBar plan={totals.plan} spent={totals.committed + totals.actual} /></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <details className={`${CARD} group`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block font-semibold text-slate-900">Monthly plan</span>
              <span className="block text-xs text-slate-500">See and edit each line&apos;s amount by month for {periodName}.</span>
            </span>
            <ChevronDown className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180" strokeWidth={2} />
          </summary>
          <div className="border-t border-slate-100">
            <p className="px-5 pt-3 text-xs text-slate-500">Click any general line&apos;s amount to change it. Totals update automatically. To edit an event line, open it in the table above and click an item.</p>
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Line</th>
                    {periodMonths.map((m) => <th key={m} scope="col" className="px-3 py-2.5 text-right font-medium">{monthLabel(m)}</th>)}
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">{isAll ? "Total" : "Range"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {rows.map((line) => (
                    <tr key={line.id}>
                      <td className="px-5 py-1.5">
                        <Link href={`/budgets/lines/${line.id}`} className="text-slate-800 hover:text-brand-700">{line.name}</Link>
                      </td>
                      {periodMonths.map((m) => (
                        <td key={m} className="px-1.5 py-1 text-right">
                          {line.kind === "general" ? (
                            <EditableMoney label={`${line.name}, ${monthLabel(m)}`} value={line.months[m] ?? 0} onSave={(value) => setLineMonth(line.id, m, value)} />
                          ) : (
                            <span className={`inline-block px-1.5 py-1 ${line.months[m] ? "text-slate-700" : "text-slate-500"}`}>{formatMoney(line.months[m] ?? 0)}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-1.5 text-right font-medium text-slate-900">{formatMoney(line.periodPlan)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                  <tr>
                    <td className="px-5 py-2.5">Planned</td>
                    {periodMonths.map((m) => <td key={m} className="px-3 py-2.5 text-right">{formatMoney(sumMoney(rows.map((l) => l.months[m] ?? 0)))}</td>)}
                    <td className="px-5 py-2.5 text-right">{formatMoney(totals.plan)}</td>
                  </tr>
                  <tr className="font-medium text-slate-600">
                    <td className="px-5 pb-2.5">Spent</td>
                    {periodMonths.map((m) => <td key={m} className="px-3 pb-2.5 text-right">{formatMoney(sumMoney(rows.map((l) => l.spentByMonth[m]?.actual ?? 0)))}</td>)}
                    <td className="px-5 pb-2.5 text-right">{formatMoney(totals.actual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </details>
      )}

      <BudgetHistory changes={changes} />
    </div>
  );
}
