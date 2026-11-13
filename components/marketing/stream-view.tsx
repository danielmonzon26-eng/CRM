"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import { AddMarketingItemButton } from "@/components/marketing/add-item-dialog";
import { ItemRow, ItemTableHead } from "@/components/marketing/planner-table";
import { money } from "@/components/ui/dashboard";
import type { MarketingStream } from "@/lib/budgets/marketing-items";
import type { ItemOptions } from "@/lib/marketing/items-queries";
import type { StreamGroup } from "@/lib/marketing/streams";

const INTRO: Record<MarketingStream, string> = {
  catapult: "Catapult's own marketing, grouped by the budget line that pays for it.",
  event: "Each event's marketing, from its Budget tab. Add items here or there; both stay in step.",
  sponsorship: "Marketing for sponsors, grouped by sponsor.",
};

/** A stream's marketing: groups with their budget, what's allocated, and editable items. */
export function StreamView({ stream, groups, options, today, extra }: { stream: MarketingStream; groups: StreamGroup[]; options: ItemOptions; today: string; extra?: React.ReactNode }) {
  const total = groups.reduce((s, g) => s + g.items.reduce((t, i) => t + i.amount, 0), 0);
  const count = groups.reduce((s, g) => s + g.items.length, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {INTRO[stream]} <span className="font-medium text-slate-800">{count} {count === 1 ? "item" : "items"} · {money(total)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {extra}
          <AddMarketingItemButton options={options} defaults={{ stream }} label="Add item" />
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
          {stream === "event" ? "No upcoming events." : "Nothing here yet. Use Add item to plan the first one."}
        </p>
      ) : (
        groups.map((g) => <Group key={g.key} group={g} options={options} today={today} />)
      )}
    </div>
  );
}

function Group({ group, options, today }: { group: StreamGroup; options: ItemOptions; today: string }) {
  const [adding, setAdding] = useState<string[]>([]);
  const line = group.line;
  const marketing = group.items.reduce((s, i) => s + i.amount, 0);
  const remaining = line ? line.amount - line.booked : 0;
  return (
    <section aria-labelledby={`grp-${group.key}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <h2 id={`grp-${group.key}`} className="font-semibold text-slate-900">
            {group.href ? (
              <Link href={group.href} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline">
                {group.title}
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            ) : (
              group.title
            )}
          </h2>
          {group.subtitle && <p className="text-xs text-slate-500">{group.subtitle}</p>}
        </div>
        {line && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {line.isEventLine && line.plannedAmount !== null && (
              <div>
                <dt className="text-xs text-slate-500">Set aside</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{money(line.plannedAmount)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">{line.isEventLine ? "Event costs" : "Budget"}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money(line.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Marketing allocated</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money(marketing)}</dd>
            </div>
            {!line.isEventLine && (
              <div>
                <dt className="text-xs text-slate-500">Left on the line</dt>
                <dd className={`font-semibold tabular-nums ${remaining < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(remaining)}</dd>
              </div>
            )}
            {line.isEventLine && line.plannedAmount !== null && (
              <div>
                <dt className="text-xs text-slate-500">{line.plannedAmount - line.amount < 0 ? "Over" : "Left"}</dt>
                <dd className={`font-semibold tabular-nums ${line.plannedAmount - line.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(Math.abs(line.plannedAmount - line.amount))}</dd>
              </div>
            )}
            {line.isEventLine && line.booked - marketing > 0 && (
              <div>
                <dt className="text-xs text-slate-500">Other event costs</dt>
                <dd className="font-semibold tabular-nums text-slate-700">{money(line.booked - marketing)}</dd>
              </div>
            )}
          </dl>
        )}
      </header>
      {group.warning && (
        <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {group.warning}
        </p>
      )}
      {(group.items.length > 0 || adding.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] table-fixed text-sm">
            <ItemTableHead />
            <tbody className="divide-y divide-slate-100">
              {adding.map((k) => (
                <ItemRow key={k} item={null} options={options} today={today} defaults={group.defaults} onDone={() => setAdding(adding.filter((x) => x !== k))} />
              ))}
              {group.items.map((i) => (
                <ItemRow key={i.id} item={i} options={options} today={today} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!(group.defaults.stream === "event" && !group.defaults.budgetLineId) && (
        <div className="border-t border-slate-100 px-5 py-2">
          <button type="button" onClick={() => setAdding([`n${Date.now()}`, ...adding])} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add {group.items.length ? "another" : "a"} marketing item{group.defaults.stream === "event" ? " for this event" : ""}
          </button>
        </div>
      )}
    </section>
  );
}
