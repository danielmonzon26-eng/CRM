"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronRight, Download, Scale } from "lucide-react";
import { updateBudgetItem } from "@/app/actions/budgets";
import { DeleteRevenueButton, RevenueForm } from "@/components/budget-controls";
import { BudgetRevenueLedger, WonDealsList } from "@/components/budget-revenue";
import { EditableMoney } from "@/components/budget-editable";
import { LineEventSelect, type EventOption } from "@/components/budget-line-rows";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page";
import type { AnalysisRow, BudgetRevenueEntry, WonDeal } from "@/lib/budgets/analysis";
import { addCents, formatMoney, fromCents, sumMoney } from "@/lib/budgets/money";
import type { BudgetOverview } from "@/lib/budgets/queries";
import { quarterLabel, quarterOf } from "@/lib/budgets/quarters";
import { calgaryDateKey } from "@/lib/events/format";
import { downloadCsv } from "@/lib/csv";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";
const REVENUE_COLOR = "#2563EB";
const COST_COLOR = "#D2460F";

type CostBasis = "actual" | "budget";
type SortKey = "name" | "revenue" | "budget" | "actual" | "net" | "return" | "registered";
type Figures = { name: string; revenue: number; budget: number; actual: number; committed: number; net: number; returnPercent: number | null; registered: number | null };

function figuresFor(row: AnalysisRow): Figures {
  const revenue = row.report?.revenue.total ?? 0;
  return {
    name: row.line.name,
    revenue,
    budget: row.line.amount,
    actual: row.line.actual,
    committed: row.line.committed,
    net: fromCents(addCents([revenue]) - addCents([row.line.actual])),
    // What came back for each dollar spent. Unknown until something is spent.
    returnPercent: row.line.actual > 0 ? Math.round(((revenue - row.line.actual) / row.line.actual) * 100) : null,
    registered: row.report?.people.registered ?? null,
  };
}

function Figure({ value, label, detail, tone = "text-slate-900" }: { value: string; label: string; detail?: string; tone?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1 : 0) : 0;
  return (
    <div className="flex items-center gap-2" title={`${label}: ${formatMoney(value)}`}>
      <span className="w-16 shrink-0 text-xs text-slate-600">{label}</span>
      <div className="h-2.5 min-w-0 flex-1">
        <div className="h-full rounded-r transition-[width] duration-300" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-700">{formatMoney(value)}</span>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align = "right" }: { label: string; sortKey: SortKey; sort: { key: SortKey; desc: boolean }; onSort: (key: SortKey) => void; align?: "left" | "right" }) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex min-h-6 items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${active ? "text-slate-900" : ""}`}>
        {label}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} strokeWidth={2} />
      </button>
    </th>
  );
}

function RowDetails({ row }: { row: AnalysisRow }) {
  const { report, line, items, revenue } = row;
  return (
    <div className="animate-fade grid gap-6 whitespace-normal p-5 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Revenue</h3>
        {report ? (
          <>
            <ul className="mt-2 divide-y divide-slate-200 text-sm">
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-700">Tickets <span className="text-xs text-slate-500">(estimated: seats × price)</span></span>
                <span className="font-medium tabular-nums text-slate-900">{formatMoney(report.revenue.ticketsEstimated)}</span>
              </li>
              {revenue.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-1">
                  <span className="min-w-0 truncate text-slate-700">{entry.source}{entry.receivedOn ? <span className="text-xs text-slate-500"> · {entry.receivedOn}</span> : null}</span>
                  <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums text-slate-900">
                    {formatMoney(entry.amount)}
                    <DeleteRevenueButton revenueId={entry.id} label={`${entry.source}, ${formatMoney(entry.amount)}`} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3"><RevenueForm eventId={report.eventId} /></div>
            <p className="mt-3 text-xs text-slate-500">
              Proposals from people who registered: {formatMoney(report.revenue.openPipeline)} open, {formatMoney(report.revenue.closedWon)} won. These are influenced by the event, so they aren&apos;t counted as its revenue.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Link this line to an event to track its tickets, sponsors, and other revenue.</p>
        )}
      </div>
      <div>
        <h3 className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900">
          Costs
          <Link href={`/budgets/lines/${line.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Expenses
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </h3>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No items yet. Add them from the Line items tab.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-200 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 truncate text-slate-700">{item.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs tabular-nums text-slate-500">{formatMoney(item.actual)} spent of</span>
                  <EditableMoney label={`${item.name} budget`} value={item.amount} onSave={(value) => updateBudgetItem(item.id, line.id, { amount: value })} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {report && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div><dt className="text-slate-500">Registered</dt><dd className="text-sm font-medium text-slate-900">{report.people.registered}</dd></div>
            <div><dt className="text-slate-500">Checked in</dt><dd className="text-sm font-medium text-slate-900">{report.people.checkedIn}</dd></div>
            <div><dt className="text-slate-500">Cost per attendee</dt><dd className="text-sm font-medium text-slate-900">{report.costPerAttendee === null ? "—" : formatMoney(report.costPerAttendee)}</dd></div>
          </dl>
        )}
      </div>
    </div>
  );
}

type QuarterFigures = { quarter: string; budget: number; actual: number; grants: number; deals: number; events: number; other: number; revenue: number; expected: number; net: number };

export function BudgetAnalysisView({
  budget,
  rows,
  events,
  revenue,
  wonDeals,
}: {
  budget: BudgetOverview;
  rows: AnalysisRow[];
  events: EventOption[];
  revenue: BudgetRevenueEntry[];
  wonDeals: WonDeal[];
}) {
  const [quarter, setQuarter] = useState("");
  const hasActuals = rows.some((r) => r.line.actual > 0);
  const [basis, setBasis] = useState<CostBasis>(hasActuals ? "actual" : "budget");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "name", desc: false });
  const [openId, setOpenId] = useState<string | null>(null);

  const eventQuarter = (row: AnalysisRow) => (row.report ? quarterOf(calgaryDateKey(row.report.startsAt)) : row.line.planMonth ? quarterOf(row.line.planMonth) : null);
  const withFigures = useMemo(
    () => rows.filter((row) => !quarter || eventQuarter(row) === quarter).map((row) => ({ row, figures: figuresFor(row) })),
    [rows, quarter]
  );

  const quarters = useMemo<QuarterFigures[]>(() => {
    const names = [...new Set([
      ...budget.months.map(quarterOf),
      ...budget.lines.flatMap((l) => Object.keys(l.spentByMonth).map(quarterOf)),
      ...revenue.map((r) => quarterOf(r.expected_on)),
      ...wonDeals.map((d) => quarterOf(d.wonOn)),
      ...rows.filter((r) => r.report).map((r) => quarterOf(calgaryDateKey(r.report!.startsAt))),
    ])].sort();
    return names.map((name) => {
      const planned = budget.lines.flatMap((l) => Object.entries(l.months).filter(([m]) => quarterOf(m) === name).map(([, v]) => v));
      const spent = budget.lines.flatMap((l) => Object.entries(l.spentByMonth).filter(([m]) => quarterOf(m) === name).map(([, v]) => v.actual));
      const entries = revenue.filter((r) => quarterOf(r.expected_on) === name);
      const received = entries.filter((r) => r.status === "received");
      const grants = sumMoney(received.filter((r) => r.kind === "grant").map((r) => r.amount));
      const other = sumMoney(received.filter((r) => r.kind !== "grant").map((r) => r.amount));
      const deals = sumMoney(wonDeals.filter((d) => quarterOf(d.wonOn) === name).map((d) => d.amount));
      const eventRevenue = sumMoney(rows.filter((r) => r.report && quarterOf(calgaryDateKey(r.report.startsAt)) === name).map((r) => r.report!.revenue.total));
      const total = sumMoney([grants, other, deals, eventRevenue]);
      const actual = sumMoney(spent);
      return {
        quarter: name,
        budget: sumMoney(planned),
        actual,
        grants,
        deals,
        events: eventRevenue,
        other,
        revenue: total,
        expected: sumMoney(entries.filter((r) => r.status === "pending" || r.status === "approved").map((r) => r.amount)),
        net: fromCents(addCents([total]) - addCents([actual])),
      };
    });
  }, [budget, revenue, wonDeals, rows]);

  const shown = quarter ? quarters.filter((q) => q.quarter === quarter) : quarters;
  const period = {
    revenue: sumMoney(shown.map((q) => q.revenue)),
    grants: sumMoney(shown.map((q) => q.grants)),
    deals: sumMoney(shown.map((q) => q.deals)),
    events: sumMoney(shown.map((q) => q.events)),
    other: sumMoney(shown.map((q) => q.other)),
    expected: sumMoney(shown.map((q) => q.expected)),
    budget: sumMoney(shown.map((q) => q.budget)),
    actual: sumMoney(shown.map((q) => q.actual)),
    net: sumMoney(shown.map((q) => q.net)),
  };
  const quarterMax = Math.max(...quarters.map((q) => Math.max(q.revenue, q.budget, q.actual)), 0);
  const sorted = useMemo(() => {
    const value = (f: Figures): number | string => {
      if (sort.key === "name") return f.name.toLowerCase();
      if (sort.key === "return") return f.returnPercent ?? Number.NEGATIVE_INFINITY;
      if (sort.key === "registered") return f.registered ?? -1;
      return f[sort.key];
    };
    return [...withFigures].sort((a, b) => {
      const [x, y] = [value(a.figures), value(b.figures)];
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -order : order;
    });
  }, [withFigures, sort]);

  const eventTotals = {
    revenue: sumMoney(withFigures.map((r) => r.figures.revenue)),
    tickets: sumMoney(rows.map((r) => r.report?.revenue.ticketsEstimated ?? 0)),
    other: sumMoney(rows.map((r) => r.report?.revenue.other ?? 0)),
    budget: sumMoney(withFigures.map((r) => r.figures.budget)),
    actual: sumMoney(withFigures.map((r) => r.figures.actual)),
    committed: sumMoney(withFigures.map((r) => r.figures.committed)),
    net: sumMoney(withFigures.map((r) => r.figures.net)),
  };
  const unlinked = rows.filter((r) => !r.line.eventId).length;
  const chartMax = Math.max(...withFigures.map((r) => Math.max(r.figures.revenue, basis === "actual" ? r.figures.actual : r.figures.budget)), 0);

  const sections = useMemo(() => {
    const names = [...new Set(budget.lines.map((l) => l.section))];
    return names.map((name) => {
      const lines = budget.lines.filter((l) => l.section === name);
      return { name, budget: sumMoney(lines.map((l) => l.amount)), actual: sumMoney(lines.map((l) => l.actual)), committed: sumMoney(lines.map((l) => l.committed)) };
    });
  }, [budget.lines]);
  const sectionMax = Math.max(...sections.map((s) => s.budget), 0);

  function onSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: key !== "name" }));
  }

  function exportCsv() {
    downloadCsv(`${budget.name} cost and revenue.csv`, [
      ["Event line", "Linked event", "Revenue", "Tickets (estimated)", "Other revenue", "Budget", "Committed", "Actual cost", "Net", "Return %", "Registered", "Open proposals", "Won proposals"],
      ...sorted.map(({ row, figures: f }) => [f.name, row.report?.title ?? "", f.revenue, row.report?.revenue.ticketsEstimated ?? 0, row.report?.revenue.other ?? 0, f.budget, f.committed, f.actual, f.net, f.returnPercent ?? "", f.registered ?? "", row.report?.revenue.openPipeline ?? 0, row.report?.revenue.closedWon ?? 0]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Quarter" className="flex flex-wrap items-center gap-1.5">
        {[["", "All quarters"] as const, ...quarters.map((q) => [q.quarter, quarterLabel(q.quarter)] as const)].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={quarter === value}
            onClick={() => setQuarter(value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${quarter === value ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Figure value={formatMoney(period.revenue)} label="Revenue" detail="Received, won, and event revenue" />
        <Figure value={formatMoney(period.grants)} label="Grants received" />
        <Figure value={formatMoney(period.deals)} label="Deals won" />
        <Figure value={formatMoney(period.expected)} label="Expected" detail="Pending or approved, not yet received" />
        <Figure value={formatMoney(period.actual)} label="Actual costs" detail={`of ${formatMoney(period.budget)} budget`} />
        <Figure value={formatMoney(period.net)} label="Net" detail="Revenue minus actual costs" tone={period.net < 0 ? "text-rose-700" : "text-slate-900"} />
      </section>

      <section className={CARD}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="font-semibold text-slate-900">Revenue and cost by quarter</h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REVENUE_COLOR }} />Revenue</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COST_COLOR }} />Actual cost</span>
            </div>
          </div>
        </header>
        {/* Focusable so the keyboard can scroll it, since nothing inside can take focus. */}
        <div tabIndex={0} role="region" aria-label="Revenue and cost by quarter" className="relative overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Quarter</th>
                <th scope="col" className="w-64 px-3 py-2.5 font-medium">Comparison</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Grants</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Deals won</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Events</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Other</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {shown.map((q) => (
                <tr key={q.quarter}>
                  <th scope="row" className="whitespace-nowrap px-5 py-2.5 text-left font-medium text-slate-900">{quarterLabel(q.quarter)}</th>
                  <td className="px-3 py-2 space-y-0.5">
                    <Bar value={q.revenue} max={quarterMax} color={REVENUE_COLOR} label="Revenue" />
                    <Bar value={q.actual} max={quarterMax} color={COST_COLOR} label="Cost" />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(q.grants)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(q.deals)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(q.events)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(q.other)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(q.budget)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${q.net < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(q.net)}</td>
                </tr>
              ))}
            </tbody>
            {shown.length > 1 && (
              <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-3 py-3 text-xs font-medium text-slate-600">{formatMoney(period.revenue)} revenue · {formatMoney(period.actual)} cost</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(period.grants)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(period.deals)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(period.events)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(period.other)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(period.budget)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${period.net < 0 ? "text-rose-700" : ""}`}>{formatMoney(period.net)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BudgetRevenueLedger budgetId={budget.id} entries={revenue} quarter={quarter} />
        <WonDealsList deals={wonDeals} quarter={quarter} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Scale} title="No event lines in this budget" description="Add an event line on the Line items tab to compare its costs with its revenue." action={<Link href="/budgets/items" className={buttonClass("secondary")}>Go to Line items</Link>} />
      ) : (
        <>
          {unlinked > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              {unlinked} of {rows.length} event {rows.length === 1 ? "line isn't" : "lines aren't"} linked to an event, so {unlinked === 1 ? "it shows" : "they show"} no revenue yet. Choose the event in the table below.
            </p>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className={CARD}>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="font-semibold text-slate-900">Revenue and cost by event</h2>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REVENUE_COLOR }} />Revenue</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COST_COLOR }} />{basis === "actual" ? "Actual cost" : "Budget"}</span>
                  </div>
                </div>
                <div role="group" aria-label="Compare revenue with" className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
                  {(["actual", "budget"] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={basis === value} onClick={() => setBasis(value)} className={`rounded-md px-2.5 py-1 capitalize transition-colors ${basis === value ? "bg-ink-950 text-white" : "text-slate-600 hover:text-slate-900"}`}>{value}</button>
                  ))}
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {withFigures.map(({ row, figures: f }) => (
                  <li key={row.line.id} className="grid gap-x-4 gap-y-1 px-5 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
                    <span className="truncate text-sm font-medium text-slate-800">{f.name}</span>
                    <div className="space-y-0.5">
                      <Bar value={f.revenue} max={chartMax} color={REVENUE_COLOR} label="Revenue" />
                      <Bar value={basis === "actual" ? f.actual : f.budget} max={chartMax} color={COST_COLOR} label={basis === "actual" ? "Cost" : "Budget"} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={CARD}>
              <header className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="font-semibold text-slate-900">Costs by section</h2>
                <p className="mt-1 text-xs text-slate-500">Actual spend against each section&apos;s budget.</p>
              </header>
              <ul className="divide-y divide-slate-100">
                {sections.map((s) => {
                  const used = s.budget > 0 ? Math.round((s.actual / s.budget) * 100) : 0;
                  return (
                    <li key={s.name} className="px-5 py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium text-slate-800">{s.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-600">{formatMoney(s.actual)} of {formatMoney(s.budget)} · {used}%</span>
                      </div>
                      {/* The track's width shows the section's share of the largest budget. */}
                      <div className="mt-1.5 h-2.5 overflow-hidden rounded-r bg-slate-200" style={{ width: `${sectionMax > 0 ? (s.budget / sectionMax) * 100 : 0}%` }}>
                        <div className="h-full" style={{ width: `${Math.min(used, 100)}%`, backgroundColor: COST_COLOR }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className={CARD}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="font-semibold text-slate-900">Event profit and loss</h2>
                <p className="mt-0.5 text-xs text-slate-500">Open an event to add revenue or change its budget. Net is revenue minus actual cost.</p>
              </div>
              <button type="button" onClick={exportCsv} className={buttonClass("secondary", "sm")}>
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Export
              </button>
            </header>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <SortHeader label="Event line" sortKey="name" sort={sort} onSort={onSort} align="left" />
                    <SortHeader label="Revenue" sortKey="revenue" sort={sort} onSort={onSort} />
                    <SortHeader label="Budget" sortKey="budget" sort={sort} onSort={onSort} />
                    <SortHeader label="Actual" sortKey="actual" sort={sort} onSort={onSort} />
                    <SortHeader label="Net" sortKey="net" sort={sort} onSort={onSort} />
                    <SortHeader label="Return" sortKey="return" sort={sort} onSort={onSort} />
                    <SortHeader label="Registered" sortKey="registered" sort={sort} onSort={onSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {sorted.map(({ row, figures: f }) => {
                    const isOpen = openId === row.line.id;
                    return (
                      <Fragment key={row.line.id}>
                        <tr className="hover:bg-slate-50">
                          <th scope="row" className="py-1.5 pl-3 pr-3 text-left font-normal">
                            <div className="flex items-start gap-1">
                              <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Close" : "Open"} ${f.name}`} onClick={() => setOpenId(isOpen ? null : row.line.id)} className="mt-0.5 shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900">
                                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={2} />
                              </button>
                              <div className="min-w-0">
                                <button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : row.line.id)} className="block py-0.5 text-left font-medium text-slate-900 hover:text-brand-700">{f.name}</button>
                                <LineEventSelect lineId={row.line.id} lineName={f.name} eventId={row.line.eventId} eventTitle={row.line.eventTitle} events={events} />
                              </div>
                            </div>
                          </th>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{row.report ? formatMoney(f.revenue) : <span className="text-slate-500">—</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(f.budget)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(f.actual)}</td>
                          <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${f.net < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(f.net)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{f.returnPercent === null ? "—" : `${f.returnPercent}%`}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{f.registered ?? "—"}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={7} className="p-0"><RowDetails row={row} /></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                  <tr>
                    <td className="px-5 py-3">All events</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(eventTotals.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(eventTotals.budget)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(eventTotals.actual)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${eventTotals.net < 0 ? "text-rose-700" : ""}`}>{formatMoney(eventTotals.net)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
