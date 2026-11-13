import { getBudgetOverview } from "@/lib/budgets/queries";
import { MARKETING_CATEGORIES, MARKETING_STREAMS, type MarketingCategory, type MarketingStream } from "@/lib/budgets/marketing-items";
import { calgaryDateKey } from "@/lib/events/format";
import { getItemOptions, getMarketingItems, type MarketingItem } from "@/lib/marketing/items-queries";
import { getPosts, type PostItem } from "@/lib/marketing/queries";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;
const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));

/** One line in a "needs attention", "running" or "upcoming" list. */
export type DashboardEntry = {
  key: string;
  kind: "item" | "post" | "promotion" | "event" | "line";
  title: string;
  detail: string;
  day: string | null;
  dayLabel: string | null;
  href: string;
  tag: string;
  tone: "rose" | "amber" | "emerald" | "sky" | "slate";
  amount?: number;
};

export type MarketingDashboard = {
  budget: {
    name: string | null;
    /** The current budget's total. */
    total: number;
    /** Marketing items booked against lines in that budget. */
    allocated: number;
    /** Committed and actual spending recorded on those items. */
    spent: number;
    remaining: number;
    byStream: { key: MarketingStream; label: string; amount: number; count: number }[];
    byType: { key: MarketingCategory; label: string; amount: number; count: number }[];
  };
  counts: { attention: number; running: number; upcoming: number };
  attention: DashboardEntry[];
  running: DashboardEntry[];
  upcoming: DashboardEntry[];
  today: string;
};

const STREAM_HREF: Record<MarketingStream, string> = { catapult: "/marketing/catapult", event: "/marketing/event", sponsorship: "/marketing/sponsorship" };

function itemEntry(i: MarketingItem, tag: string, tone: DashboardEntry["tone"]): DashboardEntry {
  const label = MARKETING_STREAMS.find(([k]) => k === i.stream)?.[1] ?? "";
  return {
    key: `i-${i.id}`,
    kind: "item",
    title: i.name,
    detail: `${label} · ${i.event?.title ?? i.sponsor?.name ?? "Catapult"}`,
    day: i.due,
    dayLabel: i.due ? fmtDay(i.due) : null,
    href: STREAM_HREF[i.stream],
    tag,
    tone,
    amount: i.amount,
  };
}

function postEntry(p: PostItem, tag: string, tone: DashboardEntry["tone"]): DashboardEntry {
  return {
    key: `p-${p.id}`,
    kind: "post",
    title: p.title,
    detail: `Social post${p.event ? ` · ${p.event.title}` : ""}`,
    day: p.dayKey,
    dayLabel: p.scheduledLabel,
    href: `/marketing/posts/${p.id}`,
    tag,
    tone,
  };
}

/** Everything the Marketing overview shows: the money, and what needs doing, is running, and is coming up. */
export async function getMarketingDashboard(now = new Date()): Promise<MarketingDashboard> {
  const supabase = await createClient();
  const today = calgaryDateKey(now);
  const in30 = calgaryDateKey(new Date(now.getTime() + 30 * DAY_MS));
  const in7 = calgaryDateKey(new Date(now.getTime() + 7 * DAY_MS));

  const [items, posts, options, overview, { data: promos, error: promosError }] = await Promise.all([
    getMarketingItems(),
    getPosts(),
    getItemOptions(now),
    // The money panel is a bonus; the lists still show if the budget can't load.
    getBudgetOverview().catch((e) => {
      console.error("Budget for the marketing overview failed:", e);
      return null;
    }),
    supabase.from("marketing_promotions").select("id, name, event_id, starts_on, ends_on, amount, status").neq("status", "done").order("starts_on"),
  ]);
  if (promosError) throw promosError;

  // ---- Money: the current budget, and the marketing items booked against it.
  const inBudget = overview ? items.filter((i) => i.budgetLine?.budgetId === overview.id) : [];
  const allocated = inBudget.reduce((s, i) => s + i.amount, 0);
  let spent = 0;
  if (inBudget.length) {
    const { data: links } = await supabase.from("marketing_items").select("budget_item_id").in("id", inBudget.map((i) => i.id));
    const budgetItemIds = (links ?? []).map((r) => r.budget_item_id).filter((x): x is string => !!x);
    if (budgetItemIds.length) {
      const { data: expenses } = await supabase.from("budget_expenses").select("amount").in("item_id", budgetItemIds);
      spent = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
    }
  }
  const total = overview?.approved ?? 0;

  // ---- Needs attention
  const attention: DashboardEntry[] = [];
  for (const i of items) if (i.due && i.due < today && i.status !== "done") attention.push(itemEntry(i, "Overdue", "rose"));
  for (const p of posts) {
    if (p.isPast && p.status !== "approved") attention.push(postEntry(p, "Date passed", "rose"));
    else if (p.status === "waiting_approval") attention.push(postEntry(p, "Waiting approval", "amber"));
    else if (p.dayKey && p.dayKey <= in7 && p.status === "requested") attention.push(postEntry(p, "Not written yet", "amber"));
  }
  for (const e of options.events)
    if (!e.lineId && e.day >= today && e.day <= in30)
      attention.push({ key: `e-${e.id}`, kind: "event", title: e.title, detail: "Event without a budget line", day: e.day, dayLabel: e.whenLabel, href: `/events/${e.id}?tab=budget`, tag: "No budget", tone: "amber" });
  for (const l of overview?.lines ?? [])
    if (l.amount > 0 && l.committed + l.actual > l.amount)
      attention.push({ key: `l-${l.id}`, kind: "line", title: l.name, detail: "Spending is over this line's budget", day: null, dayLabel: null, href: `/budgets/lines/${l.id}`, tag: "Over budget", tone: "rose", amount: l.committed + l.actual - l.amount });
  attention.sort((a, b) => (a.day ?? "0000").localeCompare(b.day ?? "0000"));

  // ---- Running now
  const eventTitle = new Map(options.events.map((e) => [e.id, e.title]));
  const running: DashboardEntry[] = [
    ...items.filter((i) => i.status === "in_progress").map((i) => itemEntry(i, "In progress", "sky")),
    ...(promos ?? [])
      .filter((p) => p.status === "running" || (p.starts_on <= today && p.ends_on >= today))
      .map(
        (p): DashboardEntry => ({
          key: `pr-${p.id}`,
          kind: "promotion",
          title: p.name,
          detail: `Paid promotion${p.event_id && eventTitle.get(p.event_id) ? ` · ${eventTitle.get(p.event_id)}` : ""}`,
          day: p.starts_on,
          dayLabel: `${fmtDay(p.starts_on)} – ${fmtDay(p.ends_on)}`,
          href: "/marketing/promotion",
          tag: p.status === "running" ? "Running" : "Should be running",
          tone: p.status === "running" ? "emerald" : "amber",
          amount: Number(p.amount),
        }),
      ),
  ];

  // ---- Upcoming: the next 30 days
  const upcoming: DashboardEntry[] = [
    ...items.filter((i) => i.due && i.due >= today && i.due <= in30 && i.status !== "done").map((i) => itemEntry(i, i.status === "in_progress" ? "In progress" : "Planned", "slate")),
    ...posts
      .filter((p) => p.dayKey && p.dayKey >= today && p.dayKey <= in30)
      .map((p) => postEntry(p, p.status === "approved" ? "Approved" : p.status === "waiting_approval" ? "Waiting approval" : "Requested", p.status === "approved" ? "emerald" : "slate")),
  ].sort((a, b) => (a.day ?? "").localeCompare(b.day ?? ""));

  return {
    budget: {
      name: overview?.name ?? null,
      total,
      allocated,
      spent,
      remaining: total - allocated,
      byStream: MARKETING_STREAMS.map(([key, label]) => {
        const list = inBudget.filter((i) => i.stream === key);
        return { key, label, amount: list.reduce((s, i) => s + i.amount, 0), count: list.length };
      }),
      byType: MARKETING_CATEGORIES.map(([key, label]) => {
        const list = inBudget.filter((i) => i.type === key);
        return { key, label, amount: list.reduce((s, i) => s + i.amount, 0), count: list.length };
      }),
    },
    counts: { attention: attention.length, running: running.length, upcoming: upcoming.length },
    attention: attention.slice(0, 12),
    running: running.slice(0, 12),
    upcoming: upcoming.slice(0, 15),
    today,
  };
}
