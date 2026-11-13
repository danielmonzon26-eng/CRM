"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Plus, Search, Wallet } from "lucide-react";
import { BudgetLineRows, type EventOption } from "@/components/budget-line-rows";
import { AddLineForm, TotalField } from "@/components/budget-overview";
import { buttonClass } from "@/components/ui/button";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { EmptyState } from "@/components/ui/page";
import { addCents, formatMoney, fromCents, sumMoney } from "@/lib/budgets/money";
import { quarterLabel, quarterOf } from "@/lib/budgets/quarters";
import type { BudgetOverview } from "@/lib/budgets/queries";
import { downloadCsv } from "@/lib/csv";

const COLUMNS = 6;

type LineFigures = { plan: number; committed: number; actual: number; remaining: number };

function addFigures(figures: LineFigures[]): LineFigures {
  return {
    plan: sumMoney(figures.map((f) => f.plan)),
    committed: sumMoney(figures.map((f) => f.committed)),
    actual: sumMoney(figures.map((f) => f.actual)),
    remaining: sumMoney(figures.map((f) => f.remaining)),
  };
}

export function BudgetItemsView({ budget, events }: { budget: BudgetOverview; events: EventOption[] }) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const [quarter, setQuarter] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const quarters = useMemo(() => [...new Set(budget.months.map(quarterOf))], [budget.months]);
  const sections = useMemo(() => [...new Set(budget.lines.map((l) => l.section))], [budget.lines]);
  const figuresFor = (line: BudgetOverview["lines"][number]): LineFigures => {
    if (!quarter) return { plan: line.amount, committed: line.committed, actual: line.actual, remaining: line.remaining };
    const months = budget.months.filter((m) => quarterOf(m) === quarter);
    const plan = sumMoney(months.map((m) => line.months[m] ?? 0));
    const committed = sumMoney(months.map((m) => line.spentByMonth[m]?.committed ?? 0));
    const actual = sumMoney(months.map((m) => line.spentByMonth[m]?.actual ?? 0));
    return { plan, committed, actual, remaining: fromCents(addCents([plan]) - addCents([committed, actual])) };
  };

  const lines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return budget.lines.filter((line) => {
      if (section && line.section !== section) return false;
      if (kind && line.kind !== kind) return false;
      if (quarter && !budget.months.some((m) => quarterOf(m) === quarter && ((line.months[m] ?? 0) > 0 || line.spentByMonth[m]))) return false;
      if (!query) return true;
      const items = budget.itemsByLine[line.id] ?? [];
      return [line.name, line.section, line.eventTitle, line.ownerName, ...items.map((i) => i.name)].some((v) => v?.toLowerCase().includes(query));
    });
  }, [budget, search, section, kind, quarter]);
  const totals = addFigures(lines.map(figuresFor));

  function exportCsv() {
    downloadCsv(`${budget.name} budget.csv`, [
      ["Row", "Section", "Line", "Item", "Period", "Budget", "Committed", "Actual", "Remaining"],
      ...lines.flatMap((line) => {
        const f = figuresFor(line);
        const row = ["Line total", line.section, line.name, "", quarter ? quarterLabel(quarter) : "All", f.plan, f.committed, f.actual, f.remaining];
        // Items aren't split by quarter, so a quarter's export has line totals only.
        const items = quarter ? [] : budget.itemsByLine[line.id] ?? [];
        return [row, ...items.map((i) => ["Item", line.section, line.name, i.name, "All", i.amount, i.committed, i.actual, i.remaining])];
      }),
    ]);
  }

  const unallocated = budget.total === null ? null : fromCents(addCents([budget.total]) - addCents([budget.approved]));
  const allocatedPct = budget.total ? Math.round((budget.approved / budget.total) * 100) : null;

  return (
    <div className="space-y-4">
      <section aria-label="Total and allocation" className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total budget</p>
            <div className="mt-1">
              <TotalField budget={budget} />
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Allocated to lines</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(budget.approved)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{unallocated !== null && unallocated < 0 ? "Over-allocated" : "Unallocated"}</dt>
              <dd className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${unallocated === null ? "text-slate-400" : unallocated < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {unallocated === null ? "—" : formatMoney(Math.abs(unallocated))}
              </dd>
            </div>
          </dl>
        </div>
        {allocatedPct !== null && (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200/70" role="progressbar" aria-label="Total budget allocated" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(allocatedPct, 100)}>
            <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${allocatedPct > 100 ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${Math.min(allocatedPct, 100)}%` }} />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Add a line for each thing the money goes to, then plan it by quarter or by item. Click any name or amount below to change it.</p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField className="flex-1" label="Search the budget" placeholder="Search lines, items, or events..." value={search} onChange={setSearch} />
        <FilterSelect label="Quarter" value={quarter} onChange={setQuarter} options={quarters.map((q) => ({ value: q, label: quarterLabel(q) }))} />
        <FilterSelect label="Section" value={section} onChange={setSection} options={sections.map((s) => ({ value: s, label: s }))} />
        <FilterSelect label="Type" value={kind} onChange={setKind} options={[{ value: "general", label: "General" }, { value: "event", label: "Event" }]} />
        <button type="button" onClick={exportCsv} disabled={lines.length === 0} className={buttonClass("secondary")}>
          <Download className="h-4 w-4" strokeWidth={2} />
          Export
        </button>
        <button ref={addRef} type="button" onClick={() => setIsAdding(true)} className={buttonClass("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add line
        </button>
      </div>

      {isAdding && (
        <AddLineForm
          budget={budget}
          sections={sections}
          stayOnPage
          onClose={() => {
            setIsAdding(false);
            addRef.current?.focus();
          }}
        />
      )}

      <p aria-live="polite" className="text-sm font-medium text-slate-900">
        {lines.length} {lines.length === 1 ? "line" : "lines"} · {formatMoney(totals.plan)} budget
      </p>

      {budget.lines.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="This budget has no lines yet"
          description="Add a line for each cost, such as ads or an event. You'll plan it by quarter or by item."
          action={!isAdding ? <button type="button" onClick={() => setIsAdding(true)} className={buttonClass("primary")}>Add the first line</button> : undefined}
        />
      ) : lines.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" description="Try a different search or filter." />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white shadow-card">
          <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">Click any name or amount to change it. A quarter's amount is shared evenly across its months, and totals update automatically.</p>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Line item</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Budget</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Committed</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Actual</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Remaining</th>
                  <th scope="col" className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {sections.filter((s) => lines.some((l) => l.section === s)).map((name) => {
                const sectionLines = lines.filter((l) => l.section === name);
                const subtotal = addFigures(sectionLines.map(figuresFor));
                return (
                  <tbody key={name} className="border-t border-slate-100">
                    <tr className="bg-slate-100/70">
                      <th colSpan={COLUMNS} scope="rowgroup" className="px-5 py-2 text-xs font-semibold text-slate-700">{name}</th>
                    </tr>
                    {sectionLines.map((line) => (
                      <BudgetLineRows
                        key={line.id}
                        line={line}
                        items={budget.itemsByLine[line.id] ?? []}
                        months={quarter ? budget.months.filter((m) => quarterOf(m) === quarter) : budget.months}
                        events={events}
                        figures={figuresFor(line)}
                        defaultOpen
                        filtered={Boolean(quarter)}
                      />
                    ))}
                    <tr className="border-t border-slate-200 text-xs font-medium text-slate-600">
                      <td className="px-5 py-2">Subtotal</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(subtotal.plan)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(subtotal.committed)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(subtotal.actual)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(subtotal.remaining)}</td>
                      <td />
                    </tr>
                  </tbody>
                );
              })}
              <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.plan)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.committed)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.actual)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.remaining)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
