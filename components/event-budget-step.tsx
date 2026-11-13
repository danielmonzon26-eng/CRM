"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Plus, Trash2, Unlink, Wallet } from "lucide-react";
import { deleteBudgetItem, saveBudgetItem } from "@/app/actions/budgets";
import { createEventBudgetLine, loadEventBudget, setEventBudgetLine, type EventBudget } from "@/app/actions/event-budget";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/budgets/money";
import { EVENT_COST_PRESETS } from "@/lib/budgets/event-presets";

// No width here: each use sets its own, so flex rows lay out side by side.
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

type Draft = { name: string; amount: string };

/**
 * The event's costs, kept on its line in a budget. Items edited here are the same items the
 * Budgets page shows, so a change in either place shows in the other.
 */
export function EventBudgetStep({
  eventId,
  onTotal,
  onSaved,
}: {
  eventId: string | null;
  onTotal: (total: number | null) => void;
  /** Called after every change, so a page showing the totals elsewhere can refresh them. */
  onSaved?: () => void;
}) {
  const [data, setData] = useState<EventBudget | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    if (!eventId) return;
    try {
      const next = await loadEventBudget(eventId);
      setData(next);
      setLoadError(false);
      onTotal(next.linked ? next.linked.amount : null);
    } catch {
      setLoadError(true);
    }
  }, [eventId, onTotal]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action().catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) setError(result.error);
      await reload();
      onSaved?.();
    });
  }

  if (!eventId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        Add the event name and start time first. The draft saves itself, then you can plan its costs here.
      </p>
    );
  }
  if (loadError) {
    return (
      <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
        The budget didn&apos;t load.{" "}
        <button type="button" onClick={() => void reload()} className="font-medium underline">
          Try again
        </button>
      </p>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Loading the budget...</p>;

  return (
    <div className="space-y-3">
      {data.linked ? (
        <LinkedLine linked={data.linked} pending={pending} run={run} eventId={eventId} />
      ) : (
        <SetUp data={data} eventId={eventId} pending={pending} run={run} />
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
    </div>
  );
}

function LinkedLine({
  linked,
  eventId,
  pending,
  run,
}: {
  linked: NonNullable<EventBudget["linked"]>;
  eventId: string;
  pending: boolean;
  run: (action: () => Promise<{ error?: string }>) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ name: "", amount: "" });
  const remaining = linked.amount - linked.spent;
  const usedNames = new Set(linked.items.map((i) => i.name.toLowerCase()));

  function addItem(name: string, amount: string) {
    run(() => saveBudgetItem({ lineId: linked.lineId, itemId: null, name, amount: amount || "0" }));
    setDraft({ name: "", amount: "" });
  }

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Wallet className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">
              In {linked.budgetName} · {linked.section}
            </p>
            <p className="text-xs text-slate-500">Changes here show on the Budgets page, and changes there show here.</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Link href={`/budgets/lines/${linked.lineId}`} target="_blank" className={buttonClass("secondary", "sm")}>
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            Open in Budgets
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Unlink this budget line from the event? The line and its items stay in the budget.")) run(() => setEventBudgetLine(eventId, null));
            }}
            className={buttonClass("ghost", "sm")}
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={2} />
            Unlink
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Cost</th>
            <th scope="col" className="w-32 px-2 py-2 text-right font-medium">Planned</th>
            <th scope="col" className="hidden w-24 px-2 py-2 text-right font-medium sm:table-cell">Spent</th>
            <th scope="col" className="w-10 px-2 py-2">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linked.items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-3 text-sm text-slate-500">
                No costs yet. Add them below.
              </td>
            </tr>
          )}
          {linked.items.map((item) => (
            <tr key={`${item.id}-${item.name}-${item.amount}`}>
              <td className="px-4 py-1.5">
                <input
                  aria-label="Cost name"
                  defaultValue={item.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== item.name) run(() => saveBudgetItem({ lineId: linked.lineId, itemId: item.id, name, amount: String(item.amount) }));
                  }}
                  className="w-full rounded-md border border-transparent px-2 py-1 hover:border-slate-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  aria-label={`Planned for ${item.name}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={item.amount}
                  onBlur={(e) => {
                    if (e.target.value !== String(item.amount)) run(() => saveBudgetItem({ lineId: linked.lineId, itemId: item.id, name: item.name, amount: e.target.value || "0" }));
                  }}
                  className="w-full rounded-md border border-transparent px-2 py-1 text-right tabular-nums hover:border-slate-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-600 sm:table-cell">{formatMoney(item.spent)}</td>
              <td className="px-2 py-1.5 text-right">
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  disabled={pending || item.spent > 0}
                  title={item.spent > 0 ? "Has expenses recorded against it" : undefined}
                  onClick={() => run(() => deleteBudgetItem(item.id, linked.lineId))}
                  className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 font-medium">
          <tr>
            <td className="px-4 py-2 text-slate-900">Total</td>
            <td className="px-2 py-2 text-right tabular-nums text-slate-900">{formatMoney(linked.amount)}</td>
            <td className="hidden px-2 py-2 text-right tabular-nums text-slate-700 sm:table-cell">{formatMoney(linked.spent)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        <p className={`text-xs ${remaining < 0 ? "font-medium text-rose-700" : "text-slate-500"}`}>
          {remaining < 0 ? `${formatMoney(-remaining)} over the plan.` : `${formatMoney(remaining)} not yet spent.`} Record spending under Budgets.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_COST_PRESETS.filter((p) => !usedNames.has(p.toLowerCase())).map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={pending}
              onClick={() => setDraft({ name: preset, amount: draft.amount })}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
            >
              + {preset}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.name.trim()) addItem(draft.name, draft.amount);
          }}
          className="flex flex-wrap gap-2"
        >
          <input aria-label="New cost" placeholder="Cost, e.g. Ad spend" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${INPUT} min-w-0 flex-1`} />
          <input
            aria-label="Planned amount"
            placeholder="$"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className={`${INPUT} w-32`}
          />
          <button type="submit" disabled={pending || !draft.name.trim()} className={buttonClass("secondary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add cost
          </button>
        </form>
      </div>
    </div>
  );
}

function SetUp({
  data,
  eventId,
  pending,
  run,
}: {
  data: EventBudget;
  eventId: string;
  pending: boolean;
  run: (action: () => Promise<{ error?: string }>) => void;
}) {
  const [budgetId, setBudgetId] = useState(data.defaultBudgetId ?? data.budgets[0]?.id ?? "");
  const sections = data.budgets.find((b) => b.id === budgetId)?.sections ?? [];
  const [section, setSection] = useState(sections[0] ?? "Events");
  const [rows, setRows] = useState<Draft[]>([
    { name: "Materials", amount: "" },
    { name: "Ad spend", amount: "" },
  ]);
  const [lineToLink, setLineToLink] = useState("");
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  if (data.budgets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        There&apos;s no budget yet.{" "}
        <Link href="/budgets" className="font-medium text-brand-700 hover:underline">
          Create one on the Budgets page
        </Link>
        , then come back to plan this event&apos;s costs.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const items = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), amount: Number(r.amount) || 0 }));
          run(() => createEventBudgetLine({ eventId, budgetId, section, items }));
        }}
        className="space-y-3 rounded-xl border border-slate-200 p-4"
      >
        <div>
          <p className="text-sm font-medium text-slate-900">Plan this event&apos;s costs</p>
          <p className="text-xs text-slate-500">They&apos;re added to a budget as this event&apos;s line, in the month the event happens.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Budget
            <select
              value={budgetId}
              onChange={(e) => {
                setBudgetId(e.target.value);
                setSection(data.budgets.find((b) => b.id === e.target.value)?.sections[0] ?? "Events");
              }}
              className={`${INPUT} mt-1 w-full`}
            >
              {data.budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.periodLabel ? ` (${b.periodLabel})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Section
            <input list="event-budget-sections" value={section} onChange={(e) => setSection(e.target.value)} className={`${INPUT} mt-1 w-full`} />
            <datalist id="event-budget-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Costs</legend>
          <ul className="mt-1.5 space-y-2">
            {rows.map((row, i) => (
              <li key={i} className="flex gap-2">
                <input
                  aria-label="Cost name"
                  value={row.name}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  className={`${INPUT} min-w-0 flex-1`}
                />
                <input
                  aria-label={`Planned for ${row.name || "this cost"}`}
                  placeholder="$"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                  className={`${INPUT} w-32`}
                />
                <button
                  type="button"
                  aria-label={`Remove ${row.name || "this cost"}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EVENT_COST_PRESETS.filter((p) => !rows.some((r) => r.name.toLowerCase() === p.toLowerCase())).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRows([...rows, { name: preset, amount: "" }])}
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
              >
                + {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRows([...rows, { name: "", amount: "" }])}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
            >
              + Other
            </button>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-700">
            Total <span className="font-semibold tabular-nums text-slate-900">{formatMoney(total)}</span>
          </p>
          <button type="submit" disabled={pending || !budgetId || !section.trim()} className={buttonClass("primary")}>
            {pending ? "Adding..." : "Add to budget"}
          </button>
        </div>
      </form>

      {data.unlinkedLines.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lineToLink) run(() => setEventBudgetLine(eventId, lineToLink));
          }}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-4"
        >
          <label className="block min-w-56 flex-1 text-sm font-medium text-slate-700">
            Already planned under Budgets? Link that line instead
            <select value={lineToLink} onChange={(e) => setLineToLink(e.target.value)} className={`${INPUT} mt-1 w-full`}>
              <option value="">Choose a line</option>
              {data.unlinkedLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.budgetName} · {formatMoney(l.amount)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending || !lineToLink} className={buttonClass("secondary")}>
            <Link2 className="h-4 w-4" strokeWidth={2} />
            Link
          </button>
        </form>
      )}
    </div>
  );
}
