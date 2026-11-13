import { PlannerView } from "@/components/marketing/planner-view";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey, fromDateTimeInput } from "@/lib/events/format";
import { getPosts } from "@/lib/marketing/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function MarketingPlannerPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const today = calgaryDateKey(new Date());
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  // Weeks start on Monday; the grid shows whole weeks around the month.
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cells }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    const key = d.toISOString().slice(0, 10);
    return { key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1, isToday: key === today, isPast: key < today };
  });

  // Calgary midnight at the start of the first cell, to midnight after the last one.
  const dayAfterGrid = new Date(Date.UTC(y, m - 1, 1 - lead + cells)).toISOString().slice(0, 10);
  const from = fromDateTimeInput(`${days[0].key}T00:00`);
  const to = fromDateTimeInput(`${dayAfterGrid}T00:00`);
  const posts = await settle(getPosts({ from, to, includeUnscheduled: true }));
  if (!posts.ok) return <LoadError what="The planner" />;

  return (
    <PlannerView
      monthLabel={monthName.format(first)}
      month={month}
      prevMonth={shiftMonth(month, -1)}
      nextMonth={shiftMonth(month, 1)}
      thisMonth={today.slice(0, 7)}
      days={days}
      posts={posts.value.filter((p) => p.scheduledAt)}
      unscheduled={posts.value.filter((p) => !p.scheduledAt)}
    />
  );
}
