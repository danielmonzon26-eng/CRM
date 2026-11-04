"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addBudgetExpense, addEventRevenue, deleteBudgetExpense, deleteEventRevenue, linkBudgetLine } from "@/app/actions/budgets";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { calgaryDateKey } from "@/lib/events/format";
import type { ExpenseStatus } from "@/lib/supabase/types";

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "text-xs font-medium text-slate-600";

/** On a budget line: choose which event this money belongs to. */
export function LineEventPicker({
  lineId,
  eventId,
  events,
}: {
  lineId: string;
  eventId: string | null;
  events: { id: string; title: string; startsAt: string; linked: boolean }[];
}) {
  const { toast } = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <label className={LABEL} htmlFor="linkedEvent">Linked event</label>
      <select
        id="linkedEvent"
        value={eventId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          setError(null);
          const next = e.target.value || null;
          startTransition(async () => {
            const result = await linkBudgetLine(lineId, next);
            if (result.error) setError(result.error);
            else toast(next ? "Event linked to this budget line" : "Event unlinked");
          });
        }}
        className={`${INPUT} mt-1`}
      >
        <option value="">Not linked</option>
        {events.filter((e) => !e.linked || e.id === eventId).map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} ({calgaryDateKey(e.startsAt)})
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

/** On an event: choose which budget line pays for it. */
export function EventLinePicker({ eventId, lines }: { eventId: string; lines: { id: string; name: string; amount: number }[] }) {
  const { toast } = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <label className={LABEL} htmlFor="budgetLine">Link a budget line</label>
      <select
        id="budgetLine"
        defaultValue=""
        disabled={isPending}
        onChange={(e) => {
          if (!e.target.value) return;
          setError(null);
          const lineId = e.target.value;
          startTransition(async () => {
            const result = await linkBudgetLine(lineId, eventId);
            if (result.error) setError(result.error);
            else toast("Budget line linked");
          });
        }}
        className={`${INPUT} mt-1 max-w-md`}
      >
        <option value="">Choose a line</option>
        {lines.map((l) => <option key={l.id} value={l.id}>{l.name} (${l.amount.toLocaleString("en-CA")})</option>)}
      </select>
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function ExpenseForm({ lineId, items }: { lineId: string; items: { id: string; name: string }[] }) {
  const today = calgaryDateKey(new Date());
  const [status, setStatus] = useState<ExpenseStatus>("actual");
  const [itemId, setItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState(today);
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addBudgetExpense({ lineId, itemId: itemId || null, status, amount, incurredOn, vendor, description });
          if (result.error) {
            setError(result.error);
          } else {
            toast("Expense added");
            setAmount("");
            setVendor("");
            setDescription("");
          }
        });
      }}
    >
      <div>
        <label className={LABEL} htmlFor="expenseAmount">Amount (CAD)</label>
        <input id="expenseAmount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <div>
        <label className={LABEL} htmlFor="expenseStatus">Type</label>
        <select id="expenseStatus" value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} className={`${INPUT} mt-1`}>
          <option value="actual">Actual (spent)</option>
          <option value="committed">Committed (promised, not yet paid)</option>
        </select>
      </div>
      <div>
        <label className={LABEL} htmlFor="expenseDate">Date</label>
        <input id="expenseDate" type="date" required value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      {items.length > 0 && (
        <div>
          <label className={LABEL} htmlFor="expenseItem">Budget item</label>
          <select id="expenseItem" value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="">No specific item</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className={LABEL} htmlFor="expenseVendor">Vendor</label>
        <input id="expenseVendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <div>
        <label className={LABEL} htmlFor="expenseDescription">Description</label>
        <input id="expenseDescription" value={description} onChange={(e) => setDescription(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-3">
        <button type="submit" disabled={isPending} className={buttonClass("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          {isPending ? "Adding..." : "Add expense"}
        </button>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
    </form>
  );
}

export function DeleteExpenseButton({ expenseId, lineId, label }: { expenseId: string; lineId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={`Delete expense ${label}`}
      onClick={async () => {
        if (!(await confirm({ title: `Delete this ${label} expense?`, body: "Budget totals update right away.", confirmLabel: "Delete", danger: true }))) return;
        startTransition(async () => {
          const result = await deleteBudgetExpense(expenseId, lineId);
          toast(result.error ?? "Expense deleted", result.error ? "error" : "success");
        });
      }}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

export function RevenueForm({ eventId }: { eventId: string }) {
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const { toast } = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addEventRevenue({ eventId, source, amount, receivedOn });
          if (result.error) {
            setError(result.error);
          } else {
            toast("Revenue added");
            setSource("");
            setAmount("");
            setReceivedOn("");
          }
        });
      }}
    >
      <div className="min-w-44 flex-1">
        <label className={LABEL} htmlFor="revenueSource">Source</label>
        <input id="revenueSource" required placeholder="e.g. Sponsor or grant" value={source} onChange={(e) => setSource(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <div className="w-32">
        <label className={LABEL} htmlFor="revenueAmount">Amount (CAD)</label>
        <input id="revenueAmount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <div>
        <label className={LABEL} htmlFor="revenueDate">Received</label>
        <input id="revenueDate" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={`${INPUT} mt-1`} />
      </div>
      <button type="submit" disabled={isPending} className={buttonClass("secondary")}>
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        Add revenue
      </button>
      {error && <p role="alert" className="w-full text-sm text-rose-700">{error}</p>}
    </form>
  );
}

export function DeleteRevenueButton({ revenueId, label }: { revenueId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={`Delete revenue ${label}`}
      onClick={async () => {
        if (!(await confirm({ title: "Delete this revenue entry?", body: label, confirmLabel: "Delete", danger: true }))) return;
        startTransition(async () => {
          const result = await deleteEventRevenue(revenueId);
          toast(result.error ?? "Revenue entry deleted", result.error ? "error" : "success");
        });
      }}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
