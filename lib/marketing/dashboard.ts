import { calgaryDateKey, EVENT_TIME_ZONE } from "@/lib/events/format";
import { initiativePhase, PLATFORMS } from "@/lib/marketing/constants";
import { getMarketingItems, type MarketingItem } from "@/lib/marketing/items-queries";
import { getInitiatives, getPosts, type InitiativeItem, type PostItem } from "@/lib/marketing/queries";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";

const DAY_MS = 86_400_000;
const eventDay = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE });

export type CoverageSlot = { days: 14 | 7 | 1; status: SocialPostStatus | null; postId: string | null; passed: boolean };

export type EventCoverage = {
  id: string;
  title: string;
  whenLabel: string;
  daysToGo: number;
  slots: CoverageSlot[];
  otherPosts: number;
};

export type MarketingDashboard = {
  waiting: number;
  next7: { total: number; approved: number; notApproved: number };
  toWrite: number;
  overdue: number;
  attention: PostItem[];
  upcoming: PostItem[];
  coverage: EventCoverage[];
  platformMonth: { platform: SocialPlatform; counts: Record<SocialPostStatus, number>; total: number }[];
  monthLabel: string;
  initiatives: (InitiativeItem & { phase: string })[];
  /** Marketing items not yet delivered: overdue or due in the next 2 weeks. */
  itemsDue: MarketingItem[];
  today: string;
};

export async function getMarketingDashboard(now = new Date()): Promise<MarketingDashboard> {
  const supabase = await createClient();
  const horizon = new Date(now.getTime() + 60 * DAY_MS).toISOString();
  const [posts, initiatives, { data: events, error }, items] = await Promise.all([
    getPosts(),
    getInitiatives(),
    supabase
      .from("events")
      .select("id, title, starts_at")
      .eq("status", "published")
      .is("archived_at", null)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon)
      .order("starts_at"),
    // The items panel is a bonus; the rest of the overview doesn't depend on it.
    getMarketingItems().catch((e) => {
      console.error("Marketing items for the overview failed:", e);
      return [] as MarketingItem[];
    }),
  ]);
  if (error) throw error;

  const t = now.getTime();
  const at = (p: PostItem) => (p.scheduledAt ? new Date(p.scheduledAt).getTime() : null);
  const within = (p: PostItem, days: number) => {
    const ms = at(p);
    return ms !== null && ms >= t && ms < t + days * DAY_MS;
  };
  const next7 = posts.filter((p) => within(p, 7));
  const overdue = posts.filter((p) => p.isPast && p.status !== "approved");
  const attention = [...overdue, ...next7.filter((p) => p.status !== "approved")]
    .sort((a, b) => (at(a) ?? 0) - (at(b) ?? 0))
    .slice(0, 8);

  const today = calgaryDateKey(now);
  const month = today.slice(0, 7);
  const monthPosts = posts.filter((p) => p.dayKey?.startsWith(month));
  const platformMonth = PLATFORMS.map((pl) => {
    const counts: Record<SocialPostStatus, number> = { requested: 0, waiting_approval: 0, approved: 0 };
    for (const p of monthPosts) if (p.platforms.includes(pl.key)) counts[p.status] += 1;
    return { platform: pl.key, counts, total: counts.requested + counts.waiting_approval + counts.approved };
  });

  const coverage: EventCoverage[] = (events ?? []).map((ev) => {
    const mine = posts.filter((p) => p.event?.id === ev.id);
    const start = new Date(ev.starts_at).getTime();
    const slots = ([14, 7, 1] as const).map((days) => {
      const post = mine.find((p) => p.autoDaysBefore === days) ?? null;
      return { days, status: post?.status ?? null, postId: post?.id ?? null, passed: start - days * DAY_MS < t };
    });
    return {
      id: ev.id,
      title: ev.title,
      whenLabel: eventDay.format(new Date(ev.starts_at)),
      daysToGo: Math.max(0, Math.ceil((start - t) / DAY_MS)),
      slots,
      otherPosts: mine.filter((p) => !p.autoDaysBefore).length,
    };
  });

  return {
    waiting: posts.filter((p) => p.status === "waiting_approval").length,
    next7: { total: next7.length, approved: next7.filter((p) => p.status === "approved").length, notApproved: next7.filter((p) => p.status !== "approved").length },
    toWrite: posts.filter((p) => p.status === "requested" && within(p, 14)).length,
    overdue: overdue.length,
    attention,
    upcoming: posts.filter((p) => p.status === "approved" && within(p, 14)).slice(0, 8),
    coverage,
    platformMonth,
    monthLabel: new Intl.DateTimeFormat("en-CA", { month: "long", timeZone: EVENT_TIME_ZONE }).format(now),
    initiatives: initiatives
      .map((i) => ({ ...i, phase: initiativePhase(i.startsOn, i.endsOn, today) }))
      .filter((i) => i.phase === "active" || i.phase === "upcoming")
      .slice(0, 5),
    itemsDue: items.filter((i) => !i.delivered && i.due && i.due <= new Date(t + 14 * DAY_MS).toISOString().slice(0, 10)).slice(0, 8),
    today,
  };
}
