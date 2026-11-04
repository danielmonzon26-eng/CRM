"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { HandCoins, Handshake, Plus, Trash2 } from "lucide-react";
import { addBudgetRevenue, deleteBudgetRevenue, updateBudgetRevenue } from "@/app/actions/budgets";
import { EditableMoney, EditableText } from "@/components/budget-editable";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { BudgetRevenueEntry, WonDeal } from "@/lib/budgets/analysis";
import { formatMoney, sumMoney } from "@/lib/budgets/money";
import { quarterLabel, quarterOf } from "@/lib/budgets/quarters";
import { calgaryDateKey } from "@/lib/events/format";
import type { BudgetRevenueKind, BudgetRevenueStatus } from "@/lib/supabase/types";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";
const INPUT = "w-full rounded-lg border border-[#8493a8] bg-white px-2.5 py-2 text-sm";
const LABEL = "text-xs font-medium text-slate-600";
const INLINE = "rounded border border-transparent bg-transparent py-1 text-sm text-slate-700 hover:border-slate-300 aria-busy:opacity-50";

const KINDS: [BudgetRevenueKind, string][] = [["grant", "Grant"], ["sponsorship", "Sponsorship"], ["other", "Other"]];
const STATUSES: [BudgetRevenueStatus, string][] = [["pending", "Pending"], ["approved", "Approved"], ["received", "Received"], ["declined", "Declined"]];
const KIND_LABELS = Object.fromEntries(KINDS) as Record<BudgetRevenueKind, string>;
const STATUS_DOTS: Record<BudgetRevenueStatus, string> = {
  pending: "bg-amber-600",
  approved: "bg-sky-600",
  received: "bg-emerald-600",
  declined: "bg-slate-500",
};

function AddRevenueForm({ budgetId, onDone }: { budgetId: string; onDone: () => void }) {
  const { toast } = useFeedback();
  const [kind, setKind] = useState<BudgetRevenueKind>("grant");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<BudgetRevenueStatus>("pending");
  const [expectedOn, setExpectedOn] = useState(() => calgaryDateKey(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="animate-fade grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-[0.8fr_1.4fr_0.7fr_0.8fr_0.9fr]"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addBudgetRevenue({ budgetId, kind, source, amount, status, expectedOn });
          if (result.error) {
            setError(result.error);
            return;
          }
          toast(`Added ${source.trim()}`);
          onDone();
        });
      }}
    >
      <label className={LABEL}>
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as BudgetRevenueKind)} className={`${INPUT} mt-1`}>
          {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={LABEL}>
        Source
        <input autoFocus required placeholder="e.g. Alberta Innovates" value={source} onChange={(e) => setSource(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      <label className={LABEL}>
        Amount (CAD)
        <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      <label className={LABEL}>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as BudgetRevenueStatus)} className={`${INPUT} mt-1`}>
          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={LABEL}>
        Expected or received
        <input required type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} className={`${INPUT} mt-1`} />
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={isPending} className={buttonClass("primary", "sm")}>{isPending ? "Adding..." : "Add revenue"}</button>
        <button type="button" onClick={onDone} className={buttonClass("ghost", "sm")}>Cancel</button>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
    </form>
  );
}

function RevenueRow({ entry, onDeleted }: { entry: BudgetRevenueEntry; onDeleted: () => void }) {
  const { toast, confirm } = useFeedback();
  const [isPending, startTransition] = useTransition();

  function change(update: { status?: BudgetRevenueStatus; expectedOn?: string }) {
    startTransition(async () => {
      const result = await updateBudgetRevenue(entry.id, update);
      toast(result.error ?? `${entry.source} updated`, result.error ? "error" : "success");
    });
  }

  return (
    <tr>
      <th scope="row" className="px-3 py-1 text-left font-normal">
        <EditableText label={`${entry.source} source`} value={entry.source} className="font-medium text-slate-900" onSave={(source) => updateBudgetRevenue(entry.id, { source })} />
        <span className="block px-1.5 text-xs text-slate-500">{KIND_LABELS[entry.kind]}</span>
      </th>
      <td className="px-1.5 py-1 text-right">
        <EditableMoney label={`${entry.source} amount`} value={entry.amount} onSave={(amount) => updateBudgetRevenue(entry.id, { amount })} />
      </td>
      <td className="whitespace-nowrap px-3 py-1">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOTS[entry.status]}`} />
          <select aria-label={`${entry.source} status`} value={entry.status} aria-busy={isPending} onChange={(e) => change({ status: e.target.value as BudgetRevenueStatus })} className={INLINE}>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </span>
      </td>
      <td className="px-3 py-1">
        <input
          type="date"
          aria-label={`${entry.source} date`}
          defaultValue={entry.expected_on}
          key={entry.expected_on}
          aria-busy={isPending}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== entry.expected_on) change({ expectedOn: e.target.value });
          }}
          className={INLINE}
        />
      </td>
      <td className="px-3 py-1 text-right">
        <button
          type="button"
          disabled={isPending}
          title="Delete"
          aria-label={`Delete ${entry.source}`}
          onClick={async () => {
            if (!(await confirm({ title: `Delete "${entry.source}"?`, body: `${formatMoney(entry.amount)} comes off this budget's revenue.`, confirmLabel: "Delete", danger: true }))) return;
            startTransition(async () => {
              const result = await deleteBudgetRevenue(entry.id);
              toast(result.error ?? "Revenue deleted", result.error ? "error" : "success");
              if (!result.error) onDeleted();
            });
          }}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </td>
    </tr>
  );
}

/** Grants, sponsorships, and other money coming in. Everything is editable where it sits. */
export function BudgetRevenueLedger({ budgetId, entries, quarter }: { budgetId: string; entries: BudgetRevenueEntry[]; quarter: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [kind, setKind] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);
  const shown = entries.filter((e) => (!quarter || quarterOf(e.expected_on) === quarter) && (!kind || e.kind === kind));

  return (
    <section className={CARD}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-slate-900">Grants and revenue</h2>
          <p className="mt-0.5 text-xs text-slate-500">Counts toward revenue once marked Received. Click anything to change it.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Revenue type" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-[#8493a8] bg-white px-2 py-1.5 text-sm text-slate-700">
            <option value="">All types</option>
            {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button ref={addRef} type="button" onClick={() => setIsAdding(true)} className={buttonClass("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Add
          </button>
        </div>
      </header>
      {isAdding && (
        <AddRevenueForm
          budgetId={budgetId}
          onDone={() => {
            setIsAdding(false);
            addRef.current?.focus();
          }}
        />
      )}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-9 text-center">
          <HandCoins className="h-5 w-5 text-slate-400" strokeWidth={2} />
          <p className="mt-2 max-w-sm text-sm text-slate-500">No grants or revenue here yet. Add a grant when you apply for it, then update its status as it moves along.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Source</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {shown.map((entry) => <RevenueRow key={entry.id} entry={entry} onDeleted={() => addRef.current?.focus()} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Won proposals flow in from the CRM, so they're changed on the proposal, not here. */
export function WonDealsList({ deals, quarter }: { deals: WonDeal[]; quarter: string }) {
  const shown = deals.filter((d) => !quarter || quarterOf(d.wonOn) === quarter);
  return (
    <section className={CARD}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-slate-900">Deals won</h2>
          <p className="mt-0.5 text-xs text-slate-500">From Proposals, by the date each one closed{quarter ? ` in ${quarterLabel(quarter)}` : ""}.</p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatMoney(sumMoney(shown.map((d) => d.amount)))}</span>
      </header>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-9 text-center">
          <Handshake className="h-5 w-5 text-slate-400" strokeWidth={2} />
          <p className="mt-2 max-w-sm text-sm text-slate-500">Proposals moved to Closed Won during this budget appear here automatically.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((deal) => (
            <li key={deal.id}>
              <Link href={`/deals/${deal.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{deal.name}</span>
                  <span className="block truncate text-xs text-slate-500">{deal.companyName ? `${deal.companyName} · ` : ""}{deal.wonOn}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatMoney(deal.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
