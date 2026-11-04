"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteBudgetItem,
  deleteBudgetLine,
  saveBudgetItem,
  setLineMonth,
  splitLineEvenly,
  updateBudgetExpense,
  updateBudgetLine,
} from "@/app/actions/budgets";
import { DeleteExpenseButton } from "@/components/budget-controls";
import { EditableMoney, EditableText } from "@/components/budget-editable";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { monthLabel } from "@/lib/budgets/history";
import { formatMoney } from "@/lib/budgets/money";
import type { ExpenseListItem, ItemSummary, LineSummary } from "@/lib/budgets/queries";
import type { ExpenseStatus } from "@/lib/supabase/types";

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "text-xs font-medium text-slate-600";
const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

export function LineDetailsForm({ line, sections, months }: { line: LineSummary; sections: string[]; months: string[] }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(line.name);
  const [section, setSection] = useState(line.section);
  const [ownerName, setOwnerName] = useState(line.ownerName ?? "");
  const [notes, setNotes] = useState(line.notes ?? "");
  const [planMonth, setPlanMonth] = useState(line.planMonth ?? months[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasExpenses = line.committed + line.actual > 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateBudgetLine(line.id, { name, section, ownerName, notes, planMonth: line.kind === "event" ? planMonth : null });
          if (result.error) setError(result.error);
          else toast("Line saved");
        });
      }}
    >
      <h2 className="font-semibold text-slate-900">Line details</h2>
      <label className={`${LABEL} block`}>
        Name
        <input required value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      <label className={`${LABEL} block`}>
        Section
        <input required list="line-sections" value={section} onChange={(e) => setSection(e.target.value)} className={`${INPUT} mt-1`} />
        <datalist id="line-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      {line.kind === "event" && (
        <label className={`${LABEL} block`}>
          Planned in
          <select value={planMonth} onChange={(e) => setPlanMonth(e.target.value)} className={`${INPUT} mt-1`}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      )}
      <label className={`${LABEL} block`}>
        Owner
        <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      <label className={`${LABEL} block`}>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="submit" disabled={isPending} className={buttonClass("primary")}>{isPending ? "Saving..." : "Save"}</button>
        <button
          type="button"
          disabled={isPending || hasExpenses}
          title={hasExpenses ? "Delete or move this line's expenses first" : undefined}
          onClick={async () => {
            const yes = await confirm({ title: `Delete "${line.name}"?`, body: "Its plan is removed from the budget. The change stays in the history.", confirmLabel: "Delete line", danger: true });
            if (!yes) return;
            startTransition(async () => {
              const result = await deleteBudgetLine(line.id);
              if (result.error) {
                setError(result.error);
                return;
              }
              toast("Line deleted");
              router.push("/budgets");
            });
          }}
          className="text-sm font-medium text-rose-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          Delete line
        </button>
      </div>
      {hasExpenses && <p className="text-xs text-slate-500">A line with expenses can&apos;t be deleted.</p>}
    </form>
  );
}

export function MonthPlanEditor({ line, months }: { line: LineSummary; months: string[] }) {
  const { toast, promptText } = useFeedback();
  const [isPending, startTransition] = useTransition();

  return (
    <section className={CARD}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-slate-900">Monthly plan</h2>
          <p className="text-xs text-slate-500">Click an amount to change it. The line&apos;s total follows.</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={async () => {
            const total = await promptText({ title: "Split a total evenly", label: `Total across ${months.length} months (CAD)`, confirmLabel: "Split" });
            if (total === null) return;
            startTransition(async () => {
              const result = await splitLineEvenly(line.id, months, total);
              toast(result.error ?? "Plan updated", result.error ? "error" : "success");
            });
          }}
          className={buttonClass("secondary", "sm")}
        >
          Split a total evenly
        </button>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 sm:grid-cols-3 lg:grid-cols-6">
        {months.map((month) => (
          <div key={month}>
            <dt className="px-1.5 text-xs text-slate-500">{monthLabel(month)}</dt>
            <dd>
              <EditableMoney label={`${line.name}, ${monthLabel(month)}`} value={line.months[month] ?? 0} onSave={(value) => setLineMonth(line.id, month, value)} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ItemsEditor({ lineId, items }: { lineId: string; items: ItemSummary[] }) {
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className={CARD}>
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="font-semibold text-slate-900">Budget items</h2>
        <p className="text-xs text-slate-500">Click a name or amount to change it. The line&apos;s total and monthly plan follow.</p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Committed</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Actual</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Remaining</th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-t border-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3.5 py-1.5">
                  <EditableText label={`${item.name} name`} value={item.name} className="text-slate-800" onSave={(value) => saveBudgetItem({ lineId, itemId: item.id, name: value, amount: String(item.amount) })} />
                  {item.notes && <span className="block px-1.5 text-xs text-slate-500">{item.notes}</span>}
                </td>
                <td className="px-1.5 py-1.5 text-right">
                  <EditableMoney label={`${item.name} budget`} value={item.amount} onSave={(value) => saveBudgetItem({ lineId, itemId: item.id, name: item.name, amount: value })} />
                </td>
                <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(item.committed)}</td>
                <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(item.actual)}</td>
                <td className={`px-3 py-1.5 text-right font-medium ${item.remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(item.remaining)}</td>
                <td className="px-3 py-1 text-right">
                  <button
                    type="button"
                    disabled={isPending}
                    aria-label={`Delete item ${item.name}`}
                    onClick={async () => {
                      const body = item.committed + item.actual > 0 ? "Its expenses stay on this line, without an item." : undefined;
                      if (!(await confirm({ title: `Delete "${item.name}"?`, body, confirmLabel: "Delete", danger: true }))) return;
                      startTransition(async () => {
                        const result = await deleteBudgetItem(item.id, lineId);
                        toast(result.error ?? "Item deleted", result.error ? "error" : "success");
                      });
                    }}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await saveBudgetItem({ lineId, itemId: null, name, amount });
            if (result.error) {
              setError(result.error);
            } else {
              toast("Item added");
              setName("");
              setAmount("");
            }
          });
        }}
      >
        <label className={`${LABEL} min-w-44 flex-1`}>
          New item
          <input required value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className={`${LABEL} w-32`}>
          Budget (CAD)
          <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <button type="submit" disabled={isPending} className={buttonClass("secondary")}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add item
        </button>
        {error && <p role="alert" className="w-full text-sm text-rose-700">{error}</p>}
      </form>
    </section>
  );
}

export function ExpenseRow({ expense, lineId, items }: { expense: ExpenseListItem; lineId: string; items: { id: string; name: string }[] }) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(expense.amount));
  const [status, setStatus] = useState<ExpenseStatus>(expense.status);
  const [incurredOn, setIncurredOn] = useState(expense.incurred_on);
  const [itemId, setItemId] = useState(expense.item_id ?? "");
  const [vendor, setVendor] = useState(expense.vendor ?? "");
  const [description, setDescription] = useState(expense.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="bg-slate-50 p-4">
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await updateBudgetExpense(expense.id, { lineId, itemId: itemId || null, status, amount, incurredOn, vendor, description });
                if (result.error) {
                  setError(result.error);
                } else {
                  toast("Expense updated");
                  setEditing(false);
                }
              });
            }}
          >
            <label className={LABEL}>Amount (CAD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} mt-1`} /></label>
            <label className={LABEL}>
              Type
              <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} className={`${INPUT} mt-1`}>
                <option value="actual">Actual (spent)</option>
                <option value="committed">Committed (promised, not yet paid)</option>
              </select>
            </label>
            <label className={LABEL}>Date<input required type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={`${INPUT} mt-1`} /></label>
            {items.length > 0 && (
              <label className={LABEL}>
                Budget item
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${INPUT} mt-1`}>
                  <option value="">No specific item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </label>
            )}
            <label className={LABEL}>Vendor<input value={vendor} onChange={(e) => setVendor(e.target.value)} className={`${INPUT} mt-1`} /></label>
            <label className={LABEL}>Description<input value={description} onChange={(e) => setDescription(e.target.value)} className={`${INPUT} mt-1`} /></label>
            <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3">
              <button type="submit" disabled={isPending} className={buttonClass("primary")}>{isPending ? "Saving..." : "Save"}</button>
              <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost")}>Cancel</button>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-5 py-2.5 text-slate-600">{expense.incurred_on}</td>
      <td className="px-3 py-2.5 text-slate-800">{[expense.vendor, expense.description].filter(Boolean).join(" · ") || "—"}</td>
      <td className="px-3 py-2.5 text-slate-600">{expense.itemName ?? "—"}</td>
      <td className="px-3 py-2.5 text-slate-600">{expense.status === "actual" ? "Actual" : "Committed"}</td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatMoney(expense.amount)}</td>
      <td className="px-3 py-1.5 text-right">
        <button type="button" aria-label={`Edit expense ${formatMoney(expense.amount)}`} onClick={() => setEditing(true)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </button>
        <DeleteExpenseButton expenseId={expense.id} lineId={lineId} label={formatMoney(expense.amount)} />
      </td>
    </tr>
  );
}
