import { calgaryDateKey, EVENT_TIME_ZONE } from "@/lib/events/format";
import { getPosts } from "@/lib/marketing/queries";
import { AD_CATEGORIES, isMarketingCategory } from "@/lib/budgets/marketing-items";
import { addDays, isAdCost, suggestPromotions, type PromotionKind, type PromotionStatus, type SuggestedPromotion } from "@/lib/marketing/promotions";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";

const eventDay = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE });

export type Promotion = {
  id: string;
  kind: PromotionKind;
  name: string;
  postId: string | null;
  postTitle: string | null;
  platforms: SocialPlatform[];
  startsOn: string;
  endsOn: string;
  amount: number;
  spent: number;
  status: PromotionStatus;
  suggested: boolean;
};

export type PromotionEvent = {
  id: string;
  title: string;
  day: string;
  whenLabel: string;
  adBudget: number;
  adItems: { name: string; amount: number }[];
  hasBudgetLine: boolean;
  promotions: Promotion[];
  suggestions: SuggestedPromotion[];
  planned: number;
  spent: number;
  markers: { days: number; postId: string; title: string; status: SocialPostStatus; day: string }[];
  posts: { id: string; title: string }[];
};

/** Upcoming published events with their ad budget, saved promotions and a suggested plan. */
export async function getPromotionTimeline(now = new Date(), eventId?: string): Promise<{ today: string; start: string; end: string; events: PromotionEvent[] }> {
  const supabase = await createClient();
  const today = calgaryDateKey(now);
  let query = supabase.from("events").select("id, title, starts_at").eq("status", "published").is("archived_at", null).gte("starts_at", now.toISOString());
  query = eventId ? query.eq("id", eventId) : query.lte("starts_at", new Date(now.getTime() + 60 * 86_400_000).toISOString());
  const { data: events, error } = await query.order("starts_at");
  if (error) throw error;
  const ids = (events ?? []).map((e) => e.id);
  if (ids.length === 0) return { today, start: today, end: addDays(today, 14), events: [] };

  const [{ data: lines, error: linesError }, { data: promos, error: promosError }, posts] = await Promise.all([
    supabase.from("budget_lines").select("id, event_id").in("event_id", ids),
    supabase.from("marketing_promotions").select("*").in("event_id", ids).order("starts_on"),
    getPosts(),
  ]);
  if (linesError) throw linesError;
  if (promosError) throw promosError;
  const lineIds = (lines ?? []).map((l) => l.id);
  const { data: items, error: itemsError } = lineIds.length
    ? await supabase.from("budget_items").select("line_id, name, amount, marketing_category").in("line_id", lineIds)
    : { data: [] as { line_id: string; name: string; amount: number; marketing_category: string | null }[], error: null };
  if (itemsError) throw itemsError;
  const postTitle = new Map(posts.map((p) => [p.id, p.title]));

  const result = (events ?? []).map((ev): PromotionEvent => {
    const day = calgaryDateKey(ev.starts_at);
    const line = (lines ?? []).find((l) => l.event_id === ev.id);
    // Marketing items in an advertising category count; uncategorised costs count by name.
    const adItems = (items ?? [])
      .filter(
        (i) =>
          i.line_id === line?.id &&
          (isMarketingCategory(i.marketing_category) ? AD_CATEGORIES.includes(i.marketing_category) : isAdCost(i.name)),
      )
      .map((i) => ({ name: i.name, amount: Number(i.amount) }));
    const adBudget = adItems.reduce((s, i) => s + i.amount, 0);
    const eventPosts = posts.filter((p) => p.event?.id === ev.id);
    const promotions = (promos ?? [])
      .filter((p) => p.event_id === ev.id)
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        postId: p.post_id,
        postTitle: p.post_id ? postTitle.get(p.post_id) ?? null : null,
        platforms: p.platforms,
        startsOn: p.starts_on,
        endsOn: p.ends_on,
        amount: Number(p.amount),
        spent: Number(p.spent),
        status: p.status,
        suggested: p.suggested,
      }));
    return {
      id: ev.id,
      title: ev.title,
      day,
      whenLabel: eventDay.format(new Date(ev.starts_at)),
      adBudget,
      adItems,
      hasBudgetLine: !!line,
      promotions,
      suggestions: promotions.length ? [] : suggestPromotions({ eventDay: day, today, budget: adBudget, posts: eventPosts.map((p) => ({ id: p.id, autoDaysBefore: p.autoDaysBefore, platforms: p.platforms })) }),
      planned: promotions.reduce((s, p) => s + p.amount, 0),
      spent: promotions.reduce((s, p) => s + p.spent, 0),
      markers: eventPosts
        .filter((p) => p.autoDaysBefore && p.dayKey)
        .map((p) => ({ days: p.autoDaysBefore!, postId: p.id, title: p.title, status: p.status, day: p.dayKey! })),
      posts: eventPosts.map((p) => ({ id: p.id, title: p.title })),
    };
  });

  const starts = result.flatMap((e) => [...e.promotions.map((p) => p.startsOn), ...e.suggestions.map((p) => p.startsOn)]);
  const start = [today, ...starts].sort()[0];
  const end = [addDays(today, 14), ...result.map((e) => e.day)].sort().at(-1)!;
  return { today, start, end, events: result };
}
