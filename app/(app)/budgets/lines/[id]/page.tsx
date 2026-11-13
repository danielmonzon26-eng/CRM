import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { ExpenseForm, LineEventPicker } from "@/components/budget-controls";
import { BudgetHistory } from "@/components/budget-history";
import { ExpenseRow, ItemsEditor, LineDetailsForm, MonthPlanEditor } from "@/components/budget-line-editors";
import { buttonClass } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { formatMoney } from "@/lib/budgets/money";
import { getBudgetChanges, getEventOptions, getLineDetail } from "@/lib/budgets/queries";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

export default async function BudgetLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, events, changes] = await Promise.all([getLineDetail(id), getEventOptions(), getBudgetChanges({ lineId: id })]);
  if (!detail) notFound();
  const { line, items, expenses, budgetName, budgetMonths, sections } = detail;

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
            <p className={`text-3xl font-bold tracking-tight ${label === "Remaining" && value < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(value)}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-5">
          {line.kind === "event" ? (
            <ItemsEditor lineId={line.id} items={items} />
          ) : (
            <MonthPlanEditor line={line} months={budgetMonths} />
          )}

          <section className={`${CARD} p-5`}>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Add an expense</h2>
            <ExpenseForm lineId={line.id} items={items.map((i) => ({ id: i.id, name: i.name }))} />
          </section>

          <section className={CARD}>
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-lg font-semibold text-slate-900">Expenses ({expenses.length})</h2>
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
                      <ExpenseRow key={e.id} expense={e} lineId={line.id} items={items.map((i) => ({ id: i.id, name: i.name }))} />
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
          <section className={`${CARD} p-5`}>
            <LineDetailsForm line={line} sections={sections} months={budgetMonths} />
          </section>
        </aside>
      </div>

      <div className="mt-5">
        <BudgetHistory changes={changes} />
      </div>
    </Page>
  );
}
