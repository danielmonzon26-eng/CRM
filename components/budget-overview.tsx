"use client";

import { Fragment } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Link2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { formatMoney, sumMoney } from "@/lib/budgets/money";
import type { BudgetOverview } from "@/lib/budgets/queries";
import { downloadCsv } from "@/lib/csv";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";
const SPENT_COLOR = "#0D9488";
const COMMITTED_COLOR = "#2563EB";
const REMAINING_COLOR = "#CBD5E1";

function monthLabel(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

function Figure({ value, label, tone = "text-slate-900" }: { value: string; label: string; tone?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}

function Donut({ budget }: { budget: BudgetOverview }) {
  const remaining = Math.max(budget.remaining, 0);
  const total = Math.max(budget.actual + budget.committed + remaining, 1);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // A 2-unit surface gap keeps neighbouring segments distinct.
  const gap = 2;
  let offset = 0;
  const parts = [
    { label: "Actual", value: budget.actual, color: SPENT_COLOR },
    { label: "Committed", value: budget.committed, color: COMMITTED_COLOR },
    { label: "Remaining", value: remaining, color: REMAINING_COLOR },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 100 100" className="h-44 w-44 -rotate-90" role="img" aria-label={`${budget.percentUsed}% of the budget is used`}>
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
          {budget.percentUsed}%
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

export function BudgetOverviewView({ budget }: { budget: BudgetOverview }) {
  const sections = [...new Set(budget.lines.map((l) => l.section))];

  function exportCsv() {
    downloadCsv(`${budget.name} ${budget.periodLabel ?? ""}.csv`.trim(), [
      ["Section", "Line", "Linked event", "Budget", ...budget.months.map(monthLabel), "Committed", "Actual", "Remaining", "Variance (budget - actual)", "Notes"],
      ...budget.lines.map((l) => [
        l.section,
        l.name,
        l.eventTitle,
        l.amount,
        ...budget.months.map((m) => l.months[m] ?? 0),
        l.committed,
        l.actual,
        l.remaining,
        l.variance,
        l.notes,
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Figure value={formatMoney(budget.approved)} label="Approved budget" />
        <Figure value={formatMoney(budget.committed)} label="Committed" />
        <Figure value={formatMoney(budget.actual)} label="Actual spend" />
        <Figure value={formatMoney(budget.remaining)} label="Remaining" tone={budget.remaining < 0 ? "text-rose-700" : "text-slate-900"} />
        <Figure value={`${budget.percentUsed}%`} label="Used" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2.4fr)]">
        <section className={`${CARD} flex items-center justify-center p-5`}>
          <Donut budget={budget} />
        </section>

        <section className={CARD}>
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <h2 className="font-semibold text-slate-900">Budget lines</h2>
            <button type="button" onClick={exportCsv} className={buttonClass("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export CSV
            </button>
          </header>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Line</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Committed</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Actual</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Remaining</th>
                </tr>
              </thead>
              {sections.map((section) => {
                const lines = budget.lines.filter((l) => l.section === section);
                return (
                  <tbody key={section} className="border-t border-slate-100">
                    <tr className="bg-slate-50">
                      <th colSpan={5} scope="colgroup" className="px-5 py-2 text-xs font-semibold text-slate-600">{section}</th>
                    </tr>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-2.5">
                          <Link href={`/budgets/lines/${line.id}`} className="font-medium text-slate-900 hover:text-brand-700">{line.name}</Link>
                          {line.kind === "event" && (
                            line.eventId ? (
                              <Link href={`/events/${line.eventId}?tab=budget`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                                <Link2 className="h-3 w-3" strokeWidth={2} />
                                {line.eventTitle}
                              </Link>
                            ) : (
                              <p className="text-xs text-slate-500">Not linked to an event</p>
                            )
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(line.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(line.committed)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(line.actual)}</td>
                        <td className={`px-5 py-2.5 text-right font-medium ${line.remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>
                          {line.remaining < 0 && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} aria-label="Over budget" />}
                          {formatMoney(line.remaining)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 text-xs font-medium text-slate-600">
                      <td className="px-5 py-2">Subtotal</td>
                      <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.amount)))}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.committed)))}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.actual)))}</td>
                      <td className="px-5 py-2 text-right">{formatMoney(sumMoney(lines.map((l) => l.remaining)))}</td>
                    </tr>
                  </tbody>
                );
              })}
              <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-3 py-3 text-right">{formatMoney(budget.approved)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(budget.committed)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(budget.actual)}</td>
                  <td className="px-5 py-3 text-right">{formatMoney(budget.remaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      <section className={CARD}>
        <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Monthly plan</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Line</th>
                {budget.months.map((m) => <th key={m} scope="col" className="px-3 py-2.5 text-right font-medium">{monthLabel(m)}</th>)}
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {budget.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-2 text-slate-800">{line.name}</td>
                  {budget.months.map((m) => (
                    <td key={m} className={`px-3 py-2 text-right ${line.months[m] ? "text-slate-700" : "text-slate-400"}`}>{formatMoney(line.months[m] ?? 0)}</td>
                  ))}
                  <td className="px-5 py-2 text-right font-medium text-slate-900">{formatMoney(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <tr>
                <td className="px-5 py-2.5">Planned</td>
                {budget.months.map((m) => (
                  <td key={m} className="px-3 py-2.5 text-right">{formatMoney(sumMoney(budget.lines.map((l) => l.months[m] ?? 0)))}</td>
                ))}
                <td className="px-5 py-2.5 text-right">{formatMoney(budget.approved)}</td>
              </tr>
              <tr className="font-medium text-slate-600">
                <td className="px-5 pb-2.5">Actual</td>
                {budget.months.map((m) => (
                  <Fragment key={m}>
                    <td className="px-3 pb-2.5 text-right">{formatMoney(budget.actualByMonth[m] ?? 0)}</td>
                  </Fragment>
                ))}
                <td className="px-5 pb-2.5 text-right">{formatMoney(budget.actual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
