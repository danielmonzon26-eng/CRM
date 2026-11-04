"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Download, Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { addBudgetLine, addBudgetQuarter, deleteEmptyBudget, renameBudget, setLineMonth } from "@/app/actions/budgets";
import { BudgetHistory } from "@/components/budget-history";
import { EditableMoney } from "@/components/budget-editable";
import { BudgetLineRows, type EventOption } from "@/components/budget-line-rows";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
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

function Figure({ value, label, tone = "text-slate-900" }: { value: string; label: string; tone?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}

function Donut({ actual, committed, remaining, percent }: { actual: number; committed: number; remaining: number; percent: number }) {
  const free = Math.max(remaining, 0);
  const total = Math.max(actual + committed + free, 1);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;
  let offset = 0;
  const parts = [
    { label: "Actual", value: actual, color: SPENT_COLOR },
    { label: "Committed", value: committed, color: COMMITTED_COLOR },
    { label: "Remaining", value: free, color: REMAINING_COLOR },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 100 100" className="h-44 w-44 -rotate-90" role="img" aria-label={`${percent}% of this period's budget is used`}>
        {parts.map((part) => {
          const length = (part.value / total) * circumference;
          const segment = (
            <circle
              key={part.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth="11"
              strokeDasharray={`${Math.max(length - (length > gap ? gap : 0), 0)} ${circumference}`}
              strokeDashoffset={-offset}
            >
              <title>{`${part.label}: ${formatMoney(part.value)}`}</title>
            </circle>
          );
          offset += length;
          return segment;
        })}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" transform="rotate(90 50 50)" className="fill-slate-900 text-[15px] font-semibold">
          {percent}%
        </text>
      </svg>
      <dl className="space-y-2 text-sm">
        {parts.map((part) => (
          <div key={part.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: part.color }} />
            <dt className="w-24 text-slate-600">{part.label}</dt>
            <dd className="font-medium text-slate-900">{formatMoney(part.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

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

export function BudgetOverviewView({ budget, changes, events }: { budget: BudgetOverview; changes: BudgetChangeRow[]; events: EventOption[] }) {
  const router = useRouter();
  const { toast, confirm, promptText } = useFeedback();
  const addRef = useRef<HTMLButtonElement>(null);
  const [period, setPeriod] = useState("all");
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const quarters = useMemo(() => [...new Set(budget.months.map(quarterOf))], [budget.months]);
  const sections = useMemo(() => [...new Set(budget.lines.map((l) => l.section))], [budget.lines]);

  const periodMonths = useMemo(() => {
    if (period === "all") return budget.months;
    if (period.includes("Q")) return budget.months.filter((m) => quarterOf(m) === period);
    return budget.months.filter((m) => m === period);
  }, [period, budget.months]);

  const rows = useMemo<PeriodRow[]>(() => {
    const query = search.trim().toLowerCase();
    return budget.lines
      .map((line) => {
        const periodPlan = sumMoney(periodMonths.map((m) => line.months[m] ?? 0));
        // "All" also counts spending dated outside the budget's months, so nothing is hidden.
        const spent = period === "all" ? { committed: line.committed, actual: line.actual } : {
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
      })
      .filter((line) => {
        if (section && line.section !== section) return false;
        if (kind && line.kind !== kind) return false;
        if (query && ![line.name, line.section, line.eventTitle, line.ownerName].some((v) => v?.toLowerCase().includes(query))) return false;
        if (status === "over" && line.periodRemaining >= 0) return false;
        if (status === "near") {
          const used = line.periodPlan > 0 ? (line.periodCommitted + line.periodActual) / line.periodPlan : 0;
          if (used < 0.9 || line.periodRemaining < 0) return false;
        }
        if (status === "unspent" && line.periodCommitted + line.periodActual > 0) return false;
        if (status === "unlinked" && (line.kind !== "event" || line.eventId)) return false;
        // A period view skips lines with nothing planned or spent in it, unless searching.
        if (period !== "all" && !query && line.periodPlan === 0 && line.periodCommitted + line.periodActual === 0) return false;
        return true;
      });
  }, [budget.lines, periodMonths, period, section, kind, status, search]);

  const totals = useMemo(() => {
    const plan = sumMoney(rows.map((r) => r.periodPlan));
    const committed = sumMoney(rows.map((r) => r.periodCommitted));
    const actual = sumMoney(rows.map((r) => r.periodActual));
    const remaining = fromCents(addCents([plan]) - addCents([committed, actual]));
    const percent = plan > 0 ? Math.round(((committed + actual) / plan) * 100) : committed + actual > 0 ? 100 : 0;
    return { plan, committed, actual, remaining, percent };
  }, [rows]);

  const visibleSections = sections.filter((s) => rows.some((r) => r.section === s));
  const hasFilters = Boolean(section || kind || status || search) || period !== "all";
  const periodName = period === "all" ? "All periods" : period.includes("Q") ? quarterLabel(period) : monthLabel(period);
  const quartersInView = new Set(periodMonths.map(quarterOf));
  const rowMonths = budget.months.filter((m) => quartersInView.has(quarterOf(m)));
  const following = budget.months.length ? monthsToAddForNextQuarter(budget.months[budget.months.length - 1]) : null;

  function clearFilters() {
    setPeriod("all");
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

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Period" className="flex flex-wrap items-center gap-1.5">
        {[
          ["all", "All periods"] as const,
          ...quarters.map((q) => [q, quarterLabel(q)] as const),
          ...budget.months.map((m) => [m, monthLabel(m)] as const),
        ].map(([value, label], index) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              period === value ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            } ${index === quarters.length ? "sm:mr-2" : ""}`}
          >
            {label}
          </button>
        ))}
        <button type="button" disabled={isPending || !following} onClick={addQuarter} className={`${buttonClass("ghost", "sm")} ml-1`}>
          <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
          {following ? `Add ${quarterLabel(following.quarter)}` : "Add quarter"}
        </button>
      </div>

      <section aria-label={`Figures for ${periodName}`} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Figure value={formatMoney(totals.plan)} label="Budget" />
        <Figure value={formatMoney(totals.committed)} label="Committed" />
        <Figure value={formatMoney(totals.actual)} label="Actual spend" />
        <Figure value={formatMoney(totals.remaining)} label="Remaining" tone={totals.remaining < 0 ? "text-rose-700" : "text-slate-900"} />
        <Figure value={`${totals.percent}%`} label="Used" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input type="search" aria-label="Search budget lines" placeholder="Search lines, sections, or events..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${SELECT} w-full pl-9`} />
        </div>
        <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className={SELECT}>
          <option value="">Section: All</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className={SELECT}>
          <option value="">Type: All</option>
          <option value="general">General</option>
          <option value="event">Event</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={SELECT}>
          <option value="">Status: All</option>
          <option value="over">Over budget</option>
          <option value="near">90% or more used</option>
          <option value="unspent">No spending yet</option>
          <option value="unlinked">Event not linked</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className={buttonClass("ghost", "sm")}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Clear
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
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
        <EmptyState icon={Search} title="No budget lines match" description={`Nothing is planned or spent for these filters in ${periodName}.`} action={<button type="button" onClick={clearFilters} className={buttonClass("secondary")}>Clear filters</button>} />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2.4fr)]">
            <section className={`${CARD} flex items-center justify-center p-5`}>
              <Donut actual={totals.actual} committed={totals.committed} remaining={totals.remaining} percent={totals.percent} />
            </section>

            <section className={CARD}>
              <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Budget lines · {periodName}</h2>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Line</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Committed</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Actual</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Remaining</th>
                      <th scope="col" className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  {visibleSections.map((name) => {
                    const lines = rows.filter((l) => l.section === name);
                    return (
                      <tbody key={name} className="border-t border-slate-100">
                        <tr className="bg-slate-50">
                          <th colSpan={6} scope="rowgroup" className="px-5 py-2 text-xs font-semibold text-slate-600">{name}</th>
                        </tr>
                        {lines.map((line) => (
                          <BudgetLineRows
                            key={line.id}
                            line={line}
                            items={budget.itemsByLine[line.id] ?? []}
                            months={rowMonths}
                            events={events}
                            filtered={period !== "all"}
                            figures={{ plan: line.periodPlan, committed: line.periodCommitted, actual: line.periodActual, remaining: line.periodRemaining }}
                          />
                        ))}
                        <tr className="border-t border-slate-200 text-xs font-medium text-slate-600">
                          <td className="px-5 py-2">Subtotal</td>
                          <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.periodPlan)))}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.periodCommitted)))}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.periodActual)))}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.periodRemaining)))}</td>
                          <td />
                        </tr>
                      </tbody>
                    );
                  })}
                  <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <tr>
                      <td className="px-5 py-3">Total</td>
                      <td className="px-3 py-3 text-right">{formatMoney(totals.plan)}</td>
                      <td className="px-3 py-3 text-right">{formatMoney(totals.committed)}</td>
                      <td className="px-3 py-3 text-right">{formatMoney(totals.actual)}</td>
                      <td className="px-3 py-3 text-right">{formatMoney(totals.remaining)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>

          <section className={CARD}>
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="font-semibold text-slate-900">Monthly plan</h2>
              <p className="text-xs text-slate-500">Click any general line&apos;s amount to change it. Totals update automatically. To edit an event line, open it in the table above and click an item.</p>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Line</th>
                    {periodMonths.map((m) => <th key={m} scope="col" className="px-3 py-2.5 text-right font-medium">{monthLabel(m)}</th>)}
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">{period === "all" ? "Total" : "Period"}</th>
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
                            <EditableMoney
                              label={`${line.name}, ${monthLabel(m)}`}
                              value={line.months[m] ?? 0}
                              onSave={(value) => setLineMonth(line.id, m, value)}
                            />
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
                    <td className="px-5 pb-2.5">Actual</td>
                    {periodMonths.map((m) => <td key={m} className="px-3 pb-2.5 text-right">{formatMoney(sumMoney(rows.map((l) => l.spentByMonth[m]?.actual ?? 0)))}</td>)}
                    <td className="px-5 pb-2.5 text-right">{formatMoney(totals.actual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      <BudgetHistory changes={changes} />
    </div>
  );
}
