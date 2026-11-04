"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createBudget, selectBudget } from "@/app/actions/budgets";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { quarterLabel, quarterMonths, quarterOf, quarterOptions } from "@/lib/budgets/quarters";
import { calgaryDateKey } from "@/lib/events/format";

const FIELD = "mt-1 w-full rounded-lg border border-[#8493a8] bg-white px-3 py-2 text-sm font-normal text-slate-900";
const DEFAULT_QUARTERS = 4;

type BudgetOption = { id: string; name: string; periodLabel: string | null };

/** Chooses which budget to look at. The choice is remembered on this browser. */
export function BudgetPicker({ budgets, selectedId, className = "" }: { budgets: BudgetOption[]; selectedId: string; className?: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="Budget"
      value={selectedId}
      aria-busy={isPending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          const result = await selectBudget(id);
          if (result.error) toast(result.error, "error");
          else router.refresh();
        });
      }}
      className={`max-w-full rounded-lg border border-[#8493a8] bg-white px-2.5 py-2 text-sm font-medium text-slate-800 aria-busy:opacity-60 ${className}`}
    >
      {budgets.map((b) => <option key={b.id} value={b.id}>{b.name}{b.periodLabel ? ` · ${b.periodLabel}` : ""}</option>)}
    </select>
  );
}

export function NewBudget() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [quarters, setQuarters] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  function show() {
    const today = calgaryDateKey(new Date());
    const options = quarterOptions(Number(today.slice(0, 4)));
    const current = options.indexOf(quarterOf(today));
    setQuarters(options);
    setStart(options[current]);
    setEnd(options[current + DEFAULT_QUARTERS - 1]);
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={show} className={buttonClass("primary")}>
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        New budget
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="new-budget-title"
          onClose={() => setOpen(false)}
          className="animate-pop m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 text-left shadow-popover backdrop:bg-ink-950/50"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "");
              setError(null);
              startTransition(async () => {
                const result = await createBudget({ name, startMonth: quarterMonths(start)[0], endMonth: quarterMonths(end)[2] });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                dialogRef.current?.close();
                toast(`Created "${name.trim()}"`);
                if (pathname === "/budgets/items") router.refresh();
                else router.push("/budgets/items");
              });
            }}
          >
            <h2 id="new-budget-title" className="text-lg font-semibold text-slate-900">New budget</h2>
            <p className="mt-1 text-sm text-slate-600">Name it and choose its quarters, then add line items. You can add more quarters later.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Budget name
              <input name="name" required autoFocus placeholder="e.g. 2027 Events" className={FIELD} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">
                First quarter
                <select
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (end < e.target.value) setEnd(e.target.value);
                  }}
                  className={FIELD}
                >
                  {quarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Last quarter
                <select value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD}>
                  {quarters.filter((q) => q >= start).map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
                </select>
              </label>
            </div>
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("secondary")}>Cancel</button>
              <button type="submit" disabled={isPending} className={buttonClass("primary")}>{isPending ? "Creating..." : "Create budget"}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
