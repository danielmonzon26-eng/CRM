import { History } from "lucide-react";
import { describeBudgetChange } from "@/lib/budgets/history";
import type { BudgetChangeRow } from "@/lib/budgets/queries";
import { EVENT_TIME_ZONE } from "@/lib/events/format";

const when = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Who changed what, in plain language. Records can't be edited or removed. */
export function BudgetHistory({ changes }: { changes: BudgetChangeRow[] }) {
  const entries = changes.flatMap((change) => {
    const text = describeBudgetChange(change);
    return text ? [{ change, text }] : [];
  });

  return (
    <details className="rounded-xl border border-slate-200 bg-white shadow-card">
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-3.5 font-semibold text-slate-900">
        <History className="h-4 w-4 text-slate-500" strokeWidth={2} />
        Change history
        <span className="text-xs font-normal text-slate-500">({entries.length})</span>
      </summary>
      {entries.length === 0 ? (
        <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-500">Changes will appear here as people edit this budget.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
          {entries.map(({ change, text }) => (
            <li key={change.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2 text-sm">
              <span className="min-w-0 text-slate-800">{text}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {change.changedByName ?? "System"} · {when.format(new Date(change.changed_at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
