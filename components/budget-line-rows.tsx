"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ChevronRight, Plus, Receipt, Trash2 } from "lucide-react";
import { deleteBudgetItem, linkBudgetLine, renameBudgetLine, saveBudgetItem, splitLineEvenly, updateBudgetItem } from "@/app/actions/budgets";
import { ExpenseForm } from "@/components/budget-controls";
import { EditableMoney, EditableText } from "@/components/budget-editable";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { addCents, formatMoney, fromCents, sumMoney } from "@/lib/budgets/money";
import type { ItemSummary, LineSummary } from "@/lib/budgets/queries";
import { quarterLabel, quarterOf } from "@/lib/budgets/quarters";
import { calgaryDateKey } from "@/lib/events/format";

const ICON_BUTTON = "rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50";
const MINI_INPUT = "rounded-md border border-[#8493a8] bg-white px-2 py-1 text-sm";

export type EventOption = { id: string; title: string; startsAt: string; linked: boolean };

/** Picks the event a line pays for, right in the table. */
export function LineEventSelect({ lineId, eventId, eventTitle, lineName, events }: { lineId: string; eventId: string | null; eventTitle: string | null; lineName: string; events: EventOption[] }) {
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Event linked to ${lineName}`}
      value={eventId ?? ""}
      aria-busy={isPending}
      onChange={(e) => {
        const next = e.target.value || null;
        startTransition(async () => {
          const result = await linkBudgetLine(lineId, next);
          toast(result.error ?? (next ? "Event linked" : "Event unlinked"), result.error ? "error" : "success");
        });
      }}
      className={`min-h-6 max-w-56 rounded border border-transparent bg-transparent py-0.5 text-xs hover:border-slate-300 aria-busy:opacity-50 ${eventId ? "text-brand-700" : "text-slate-500"}`}
    >
      <option value="">Not linked to an event</option>
      {/* A cancelled or archived event isn't offered, but the link to it still shows. */}
      {eventId && !events.some((e) => e.id === eventId) && <option value={eventId}>{eventTitle ?? "Linked event"}</option>}
      {events.filter((e) => !e.linked || e.id === eventId).map((e) => <option key={e.id} value={e.id}>{e.title} ({calgaryDateKey(e.startsAt)})</option>)}
    </select>
  );
}

function AddExpense({ line, items }: { line: LineSummary; items: ItemSummary[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  return (
    <>
      <button type="button" title="Add expense" aria-label={`Add expense to ${line.name}`} onClick={() => setOpen(true)} className={ICON_BUTTON}>
        <Receipt className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby={`expense-${line.id}`}
          onClose={() => setOpen(false)}
          className="animate-pop m-auto w-[calc(100%-2rem)] max-w-xl whitespace-normal rounded-xl bg-white p-5 text-left font-normal shadow-popover backdrop:bg-ink-950/50"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={`expense-${line.id}`} className="text-lg font-semibold text-slate-900">Add an expense</h2>
              <p className="truncate text-sm text-slate-600">{line.name}</p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("secondary", "sm")}>Cancel</button>
          </div>
          <ExpenseForm lineId={line.id} items={items} onAdded={() => dialogRef.current?.close()} />
        </dialog>
      )}
    </>
  );
}

function AddItemRow({ lineId, colSpan }: { lineId: string; colSpan: number }) {
  const { toast } = useFeedback();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="bg-slate-50/60">
      <td colSpan={colSpan} className="px-5 py-2 pl-12">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await saveBudgetItem({ lineId, itemId: null, name, amount });
              if (result.error) {
                toast(result.error, "error");
                return;
              }
              toast(`${name.trim()} added`);
              setName("");
              setAmount("");
            });
          }}
        >
          <input required aria-label="New item name" placeholder="New item, e.g. Venue" value={name} onChange={(e) => setName(e.target.value)} className={`${MINI_INPUT} min-w-44 flex-1 sm:max-w-72`} />
          <input required aria-label="New item budget" type="number" min="0" step="0.01" placeholder="Budget" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${MINI_INPUT} w-28`} />
          <button type="submit" disabled={isPending} className={buttonClass("secondary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            {isPending ? "Adding..." : "Add item"}
          </button>
        </form>
      </td>
    </tr>
  );
}

/** How much of a budget is spent or committed, as a short bar and a percentage. */
export function UsedBar({ plan, spent }: { plan: number; spent: number }) {
  const percent = plan > 0 ? Math.round((spent / plan) * 100) : spent > 0 ? 100 : 0;
  const tone = percent > 100 ? "bg-rose-500" : percent >= 90 ? "bg-amber-500" : "bg-accent-500";
  return (
    <div className="flex items-center gap-2" title={`${percent}% of this budget used`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className={`w-10 text-right text-xs tabular-nums ${percent > 100 ? "font-medium text-rose-700" : "text-slate-500"}`}>{percent}%</span>
    </div>
  );
}

/** A budget line in a table. Opening it shows its items or months, all editable where they sit. */
export function BudgetLineRows({
  line,
  items,
  months,
  events,
  figures,
  defaultOpen = false,
  filtered = false,
  showUsed = false,
}: {
  line: LineSummary;
  items: ItemSummary[];
  months: string[];
  events: EventOption[];
  figures: { plan: number; committed: number; actual: number; remaining: number };
  defaultOpen?: boolean;
  /** A period is selected, so the line's figures and its items cover different spans. */
  filtered?: boolean;
  /** Adds a "Used" column with a progress bar, after Remaining. */
  showUsed?: boolean;
}) {
  const { toast, confirm } = useFeedback();
  const [open, setOpen] = useState(defaultOpen);
  const [isPending, startTransition] = useTransition();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const columns = showUsed ? 7 : 6;
  const usedCell = showUsed ? <td /> : null;

  // Spending recorded on the line without choosing an item, so the rows still add up to the line.
  const looseCommitted = fromCents(addCents([line.committed]) - addCents(items.map((i) => i.committed)));
  const looseActual = fromCents(addCents([line.actual]) - addCents(items.map((i) => i.actual)));
  const hasLoose = line.kind === "event" && (looseCommitted !== 0 || looseActual !== 0);

  return (
    <>
      <tr className="group border-t border-slate-100 hover:bg-slate-50">
        <th scope="row" className="py-1.5 pl-3 pr-3 text-left font-normal">
          <div className="flex items-start gap-1">
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-label={`${open ? "Close" : "Open"} ${line.name}`}
              onClick={() => setOpen(!open)}
              className="mt-0.5 shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <EditableText label={`${line.name} name`} value={line.name} className="font-medium text-slate-900" onSave={(value) => renameBudgetLine(line.id, value)} />
              {line.kind === "event" && (
                <div className="flex items-center gap-1 pl-1">
                  <LineEventSelect lineId={line.id} lineName={line.name} eventId={line.eventId} eventTitle={line.eventTitle} events={events} />
                  {line.eventId && (
                    <Link href={`/events/${line.eventId}?tab=budget`} title="Open event" aria-label={`Open event ${line.eventTitle ?? ""}`} className="rounded p-[5px] text-brand-700 hover:bg-slate-200 hover:text-brand-800">
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </th>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(figures.plan)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(figures.committed)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatMoney(figures.actual)}</td>
        <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${figures.remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>
          {figures.remaining < 0 && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} aria-label="Over budget" />}
          {formatMoney(figures.remaining)}
        </td>
        {showUsed && (
          <td className="px-3 py-2.5">
            <UsedBar plan={figures.plan} spent={figures.committed + figures.actual} />
          </td>
        )}
        <td className="whitespace-nowrap px-3 py-1.5 text-right">
          <AddExpense line={line} items={items} />
          <Link href={`/budgets/lines/${line.id}`} title="Open full line" aria-label={`Open ${line.name}`} className={`${ICON_BUTTON} inline-block align-middle`}>
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </td>
      </tr>

      {open && line.kind === "event" && (
        <>
          {filtered && items.length > 0 && (
            <tr className="border-t border-slate-100 bg-slate-50/60">
              <td colSpan={columns} className="py-1.5 pl-[52px] pr-3 text-xs text-slate-500">Items below cover this whole line, not only the selected period.</td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} className="animate-fade border-t border-slate-100 bg-slate-50/60">
              <th scope="row" className="py-1 pl-11 pr-3 text-left font-normal">
                <span className="sr-only">Item of {line.name}: </span>
                <EditableText label={`${item.name} name`} value={item.name} className="text-slate-800" onSave={(value) => updateBudgetItem(item.id, line.id, { name: value })} />
              </th>
              <td className="px-1.5 py-1 text-right">
                <EditableMoney label={`${item.name} budget`} value={item.amount} onSave={(value) => updateBudgetItem(item.id, line.id, { amount: value })} />
              </td>
              <td className="px-3 py-1 text-right tabular-nums text-slate-600">{formatMoney(item.committed)}</td>
              <td className="px-3 py-1 text-right tabular-nums text-slate-600">{formatMoney(item.actual)}</td>
              <td className={`px-3 py-1 text-right tabular-nums ${item.remaining < 0 ? "font-medium text-rose-700" : "text-slate-700"}`}>{formatMoney(item.remaining)}</td>
              {usedCell}
              <td className="px-3 py-1 text-right">
                <button
                  type="button"
                  disabled={isPending}
                  title="Delete item"
                  aria-label={`Delete item ${item.name}`}
                  onClick={async () => {
                    const body = item.committed + item.actual > 0 ? "Its expenses stay on this line, without an item." : undefined;
                    if (!(await confirm({ title: `Delete "${item.name}"?`, body, confirmLabel: "Delete", danger: true }))) return;
                    startTransition(async () => {
                      const result = await deleteBudgetItem(item.id, line.id);
                      toast(result.error ?? "Item deleted", result.error ? "error" : "success");
                      toggleRef.current?.focus();
                    });
                  }}
                  className={ICON_BUTTON}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </td>
            </tr>
          ))}
          {hasLoose && (
            <tr className="border-t border-slate-100 bg-slate-50/60 text-slate-500">
              <td className="py-2 pl-[52px] pr-3 italic">No specific item</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(looseCommitted)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(looseActual)}</td>
              <td colSpan={columns - 4} />
            </tr>
          )}
          <AddItemRow lineId={line.id} colSpan={columns} />
        </>
      )}

      {open && line.kind === "general" && [...new Set(months.map(quarterOf))].map((quarter) => {
        const quarterMonths = months.filter((m) => quarterOf(m) === quarter);
        const plan = sumMoney(quarterMonths.map((m) => line.months[m] ?? 0));
        const committed = sumMoney(quarterMonths.map((m) => line.spentByMonth[m]?.committed ?? 0));
        const actual = sumMoney(quarterMonths.map((m) => line.spentByMonth[m]?.actual ?? 0));
        return (
          <tr key={quarter} className="animate-fade border-t border-slate-100 bg-slate-50/60">
            <th scope="row" className="py-1 pl-[52px] pr-3 text-left font-normal text-slate-700"><span className="sr-only">{line.name}, </span>{quarterLabel(quarter)}</th>
            <td className="px-1.5 py-1 text-right">
              {/* A quarter's amount is shared evenly across its months. */}
              <EditableMoney label={`${line.name}, ${quarterLabel(quarter)}`} value={plan} onSave={(value) => splitLineEvenly(line.id, quarterMonths, value)} />
            </td>
            <td className="px-3 py-1 text-right tabular-nums text-slate-600">{formatMoney(committed)}</td>
            <td className="px-3 py-1 text-right tabular-nums text-slate-600">{formatMoney(actual)}</td>
            <td className="px-3 py-1 text-right tabular-nums text-slate-700">{formatMoney(fromCents(addCents([plan]) - addCents([committed, actual])))}</td>
            {usedCell}
            <td />
          </tr>
        );
      })}
    </>
  );
}
