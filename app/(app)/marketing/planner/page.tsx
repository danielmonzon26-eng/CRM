import Link from "next/link";
import { CalendarDays, Table2 } from "lucide-react";
import { PlannerTable } from "@/components/marketing/planner-table";
import { PlannerView } from "@/components/marketing/planner-view";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey, fromDateTimeInput } from "@/lib/events/format";
import { getItemOptions, getMarketingItems } from "@/lib/marketing/items-queries";
import { getPosts } from "@/lib/marketing/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The marketing planner: every marketing item and social post, as a calendar or an editable table. */
export default async function MarketingPlannerPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const { month: requested, view } = await searchParams;
  const table = view === "table";
  const today = calgaryDateKey(new Date());

  const switcher = (
    <div role="tablist" aria-label="View" className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {(
        [
          ["calendar", "Calendar", CalendarDays],
          ["table", "Table", Table2],
        ] as const
      ).map(([key, label, Icon]) => {
        const on = (key === "table") === table;
        return (
          <Link
            key={key}
            role="tab"
            aria-selected={on}
            href={key === "table" ? "/marketing/planner?view=table" : `/marketing/planner${requested ? `?month=${requested}` : ""}`}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </div>
  );

  if (table) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [items, posts, options] = await Promise.all([settle(getMarketingItems()), settle(getPosts()), settle(getItemOptions())]);
    if (!items.ok || !posts.ok || !options.ok) return <LoadError what="The planner" />;
    return (
      <div>
        {switcher}
        <PlannerTable items={items.value} posts={posts.value.filter((p) => !p.scheduledAt || p.scheduledAt >= since)} options={options.value} today={today} />
      </div>
    );
  }

  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cells }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    const key = d.toISOString().slice(0, 10);
    return { key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1, isToday: key === today, isPast: key < today };
  });
  const dayAfterGrid = new Date(Date.UTC(y, m - 1, 1 - lead + cells)).toISOString().slice(0, 10);
  const [posts, items] = await Promise.all([
    settle(getPosts({ from: fromDateTimeInput(`${days[0].key}T00:00`), to: fromDateTimeInput(`${dayAfterGrid}T00:00`), includeUnscheduled: true })),
    settle(getMarketingItems()),
  ]);
  if (!posts.ok || !items.ok) return <LoadError what="The planner" />;

  return (
    <div>
      {switcher}
      <PlannerView
        monthLabel={monthName.format(first)}
        month={month}
        prevMonth={shiftMonth(month, -1)}
        nextMonth={shiftMonth(month, 1)}
        thisMonth={today.slice(0, 7)}
        days={days}
        posts={posts.value.filter((p) => p.scheduledAt)}
        unscheduled={posts.value.filter((p) => !p.scheduledAt)}
        items={items.value}
        basePath="/marketing/planner"
      />
    </div>
  );
}
