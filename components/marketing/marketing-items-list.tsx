"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Package } from "lucide-react";
import { setMarketingItemDelivered } from "@/app/actions/event-budget";
import { money } from "@/components/ui/dashboard";
import { useFeedback } from "@/components/ui/feedback";
import { DELIVERY_TIMINGS, MARKETING_CATEGORIES, MARKETING_CATEGORY_LABELS, MARKETING_CATEGORY_STYLES, type MarketingCategory } from "@/lib/budgets/marketing-items";
import type { MarketingItem } from "@/lib/marketing/items-queries";

const dueFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const TIMING_LABEL = Object.fromEntries(DELIVERY_TIMINGS) as Record<string, string>;

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every marketing item booked on an event budget, grouped by when it's due. */
export function MarketingItemsList({ items, today }: { items: MarketingItem[]; today: string }) {
  const [categories, setCategories] = useState<MarketingCategory[]>([]);
  const [showDelivered, setShowDelivered] = useState(false);
  const visible = items.filter((i) => categories.length === 0 || categories.includes(i.category));
  const open = visible.filter((i) => !i.delivered);
  const weekEnd = addDays(today, 7);
  const groups: [string, string, MarketingItem[]][] = [
    ["overdue", "Overdue", open.filter((i) => i.due && i.due < today)],
    ["week", "Due in the next 7 days", open.filter((i) => i.due && i.due >= today && i.due <= weekEnd)],
    ["later", "Later", open.filter((i) => i.due && i.due > weekEnd)],
    ["nodate", "No delivery date", open.filter((i) => !i.due)],
  ];
  const delivered = visible.filter((i) => i.delivered);
  const totals = MARKETING_CATEGORIES.map(([key, label]) => ({ key, label, amount: items.filter((i) => i.category === key).reduce((s, i) => s + i.amount, 0) })).filter((t) => t.amount > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Booked from the <span className="font-medium">Marketing items</span> on each event&apos;s Budget tab.
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {MARKETING_CATEGORIES.map(([key, label]) => {
            const on = categories.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setCategories(on ? categories.filter((c) => c !== key) : [...categories, key])}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {totals.length > 0 && (
        <dl className="flex flex-wrap gap-2">
          {totals.map((t) => (
            <div key={t.key} className={`rounded-lg px-3 py-1.5 text-xs ${MARKETING_CATEGORY_STYLES[t.key]}`}>
              <dt className="inline font-medium">{t.label}</dt> <dd className="inline tabular-nums">{money(t.amount)}</dd>
            </div>
          ))}
        </dl>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Package className="mx-auto h-6 w-6 text-slate-400" strokeWidth={2} />
          <p className="mt-2 font-medium text-slate-900">No marketing items yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Add them on an event&apos;s Budget tab under Marketing items, with a category and delivery date.</p>
        </div>
      ) : (
        <>
          {groups
            .filter(([, , list]) => list.length > 0)
            .map(([key, label, list]) => (
              <section key={key} aria-labelledby={`grp-${key}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                <h2 id={`grp-${key}`} className={`flex items-center gap-1.5 border-b border-slate-100 px-5 py-2.5 text-sm font-semibold ${key === "overdue" ? "text-rose-700" : "text-slate-900"}`}>
                  {key === "overdue" && <AlertTriangle className="h-4 w-4" strokeWidth={2} />}
                  {label} ({list.length})
                </h2>
                <ItemTable items={list} overdue={key === "overdue"} />
              </section>
            ))}
          {open.length === 0 && <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-600">Everything here has been delivered.</p>}
          {delivered.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <button type="button" onClick={() => setShowDelivered(!showDelivered)} aria-expanded={showDelivered} className="w-full px-5 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {showDelivered ? "Hide" : "Show"} delivered ({delivered.length})
              </button>
              {showDelivered && <ItemTable items={delivered} overdue={false} />}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ItemTable({ items, overdue }: { items: MarketingItem[]; overdue: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed text-sm">
        <colgroup>
          <col className="w-12" />
          <col />
          <col className="w-56" />
          <col className="w-40" />
          <col className="w-28" />
        </colgroup>
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th scope="col" className="w-12 px-5 py-2 font-medium">
              <span className="sr-only">Delivered</span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">Item</th>
            <th scope="col" className="px-2 py-2 font-medium">Event</th>
            <th scope="col" className="px-2 py-2 font-medium">Due</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 border-t border-slate-100">
          {items.map((i) => (
            <Row key={i.id} item={i} overdue={overdue} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ item, overdue }: { item: MarketingItem; overdue: boolean }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(item.delivered);
  return (
    <tr className={pending ? "opacity-60" : ""}>
      <td className="px-5 py-2.5">
        <input
          type="checkbox"
          aria-label={`Mark ${item.name} as delivered`}
          checked={done}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setDone(next);
            startTransition(async () => {
              const result = await setMarketingItemDelivered(item.id, next).catch(() => ({ error: "That didn't save. Please try again." }));
              if (result.error) {
                setDone(!next);
                toast(result.error, "error");
              } else {
                toast(next ? "Marked as delivered." : "Marked as not delivered.");
                router.refresh();
              }
            });
          }}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
        />
      </td>
      <td className="px-2 py-2.5">
        <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${MARKETING_CATEGORY_STYLES[item.category]}`}>{MARKETING_CATEGORY_LABELS[item.category]}</span>
        <span className={done ? "text-slate-500 line-through" : "text-slate-900"}>{item.name}</span>
      </td>
      <td className="px-2 py-2.5">
        <Link href={`/events/${item.event.id}?tab=budget`} className="text-slate-700 hover:text-brand-700 hover:underline">
          {item.event.title}
        </Link>
        <span className="block text-xs text-slate-500">{item.event.whenLabel}</span>
      </td>
      <td className="px-2 py-2.5">
        <span className={overdue ? "font-medium text-rose-700" : "text-slate-800"}>{item.due ? dueFormat.format(new Date(`${item.due}T00:00:00Z`)) : "—"}</span>
        {item.timing && item.timing !== "custom" && <span className="block text-xs text-slate-500">{TIMING_LABEL[item.timing]}</span>}
      </td>
      <td className="px-5 py-2.5 text-right tabular-nums text-slate-900">{money(item.amount)}</td>
    </tr>
  );
}
