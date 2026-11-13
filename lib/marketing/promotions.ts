import type { SocialPlatform } from "@/lib/supabase/types";

export type PromotionKind = "boost" | "ad";
export type PromotionStatus = "planned" | "running" | "done";

export const PROMOTION_STATUS_META: Record<PromotionStatus, { label: string; pill: string }> = {
  planned: { label: "Planned", pill: "bg-sky-50 text-sky-800" },
  running: { label: "Running", pill: "bg-emerald-50 text-emerald-800" },
  done: { label: "Done", pill: "bg-slate-100 text-slate-700" },
};

const AD_COST = /\b(ads?|ad spend|advertis\w*|boost\w*|paid social|social media|social ads?|sponsored)\b/i;

/** Whether a budget cost on an event pays for social ads or boosts (print doesn't count). */
export function isAdCost(name: string): boolean {
  return AD_COST.test(name) && !/print/i.test(name);
}

/** Calendar-day arithmetic on YYYY-MM-DD keys. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export type SuggestedPromotion = {
  kind: PromotionKind;
  name: string;
  postId: string | null;
  platforms: SocialPlatform[];
  startsOn: string;
  endsOn: string;
  amount: number;
};

const META_PLATFORMS: SocialPlatform[] = ["facebook", "instagram"];

/**
 * A starting plan for an event's ad budget: boost the 2-week post for a week (60%), then
 * the 1-week post until two days out (40%). A window that has already started is
 * shortened; one that has passed hands its share to the next. With both gone, the
 * budget becomes one final-push ad up to the day before.
 */
export function suggestPromotions(input: {
  eventDay: string;
  today: string;
  budget: number;
  posts: { id: string; autoDaysBefore: number | null; platforms: SocialPlatform[] }[];
}): SuggestedPromotion[] {
  const budget = Math.floor(input.budget);
  if (budget <= 0) return [];
  const E = input.eventDay;
  const windows = [
    { days: 14, name: "2 weeks to go", start: addDays(E, -14), end: addDays(E, -8), share: 0.6 },
    { days: 7, name: "1 week to go", start: addDays(E, -7), end: addDays(E, -2), share: 0.4 },
  ]
    .map((w) => ({ ...w, start: w.start < input.today ? input.today : w.start }))
    .filter((w) => w.start <= w.end);

  if (windows.length === 0) {
    const end = addDays(E, -1);
    if (input.today > end) return [];
    return [{ kind: "ad", name: "Ad: final push", postId: null, platforms: META_PLATFORMS, startsOn: input.today, endsOn: end, amount: budget }];
  }

  const totalShare = windows.reduce((s, w) => s + w.share, 0);
  let left = budget;
  return windows.map((w, i) => {
    const amount = i === windows.length - 1 ? left : Math.round((budget * w.share) / totalShare);
    left -= amount;
    const post = input.posts.find((p) => p.autoDaysBefore === w.days);
    return post
      ? { kind: "boost" as const, name: `Boost: ${w.name}`, postId: post.id, platforms: post.platforms.length ? post.platforms : META_PLATFORMS, startsOn: w.start, endsOn: w.end, amount }
      : { kind: "ad" as const, name: `Ad: ${w.name}`, postId: null, platforms: META_PLATFORMS, startsOn: w.start, endsOn: w.end, amount };
  });
}

/** Spend per day across a window, both ends included. */
export function dailySpend(amount: number, startsOn: string, endsOn: string): number {
  const days = daysBetween(startsOn, endsOn) + 1;
  return days > 0 ? Math.round((amount / days) * 100) / 100 : amount;
}
