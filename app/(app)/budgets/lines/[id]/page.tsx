import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { DeleteExpenseButton, ExpenseForm, LineEventPicker } from "@/components/budget-controls";
import { buttonClass } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { formatMoney } from "@/lib/budgets/money";
import { getEventOptions, getLineDetail } from "@/lib/budgets/queries";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

function monthLabel(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function BudgetLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, events] = await Promise.all([getLineDetail(id), getEventOptions()]);
  if (!detail) notFound();
  const { line, items, expenses, budgetName } = detail;
  const plannedMonths = Object.entries(line.months).filter(([, amount]) => amount > 0).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Page>
      <PageHeader
        title={line.name}
        subtitle={`${budgetName} · ${line.section}${line.ownerName ? ` · ${line.ownerName}` : ""}`}
        actions={
          line.eventId ? (
            <Link href={`/events/${line.eventId}?tab=budget`} className={buttonClass("secondary")}>
              Open event
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          ) : undefined
        }
      />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Budget", line.amount],
          ["Committed", line.committed],
          ["Actual", line.actual],
          ["Remaining", line.remaining],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label} className={`${CARD} p-4`}>
            <p className={`text-2xl font-semibold tracking-tight ${label === "Remaining" && value < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(value)}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-5">
          {items.length > 0 && (
            <section className={CARD}>
              <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Budget items</h2>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Committed</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Actual</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-2.5 text-slate-800">
                          {item.name}
                          {item.notes && <span className="block text-xs text-slate-500">{item.notes}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(item.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(item.committed)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(item.actual)}</td>
                        <td className={`px-5 py-2.5 text-right font-medium ${item.remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(item.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={`${CARD} p-5`}>
            <h2 className="mb-3 font-semibold text-slate-900">Add an expense</h2>
            <ExpenseForm lineId={line.id} items={items.map((i) => ({ id: i.id, name: i.name }))} />
          </section>

          <section className={CARD}>
            <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Expenses ({expenses.length})</h2>
            {expenses.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No expenses yet.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Details</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Item</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                      <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-2.5 text-slate-600">{e.incurred_on}</td>
                        <td className="px-3 py-2.5 text-slate-800">{[e.vendor, e.description].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{e.itemName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{e.status === "actual" ? "Actual" : "Committed"}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatMoney(e.amount)}</td>
                        <td className="px-3 py-1.5 text-right"><DeleteExpenseButton expenseId={e.id} lineId={line.id} label={formatMoney(e.amount)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className={`${CARD} p-5`}>
            <LineEventPicker lineId={line.id} eventId={line.eventId} events={events} />
            <Link href="/events/new" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">Create a new event</Link>
          </section>
          <section className={`${CARD} p-5 text-sm`}>
            <h2 className="font-semibold text-slate-900">Monthly plan</h2>
            <dl className="mt-2 space-y-1">
              {plannedMonths.map(([month, amount]) => (
                <div key={month} className="flex justify-between">
                  <dt className="text-slate-600">{monthLabel(month)}</dt>
                  <dd className="font-medium text-slate-900">{formatMoney(amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
          {line.notes && (
            <section className={`${CARD} p-5 text-sm`}>
              <h2 className="font-semibold text-slate-900">Notes</h2>
              <p className="mt-1 text-slate-600">{line.notes}</p>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
