/** The kinds of marketing cost an event can book, in the order they're offered. */
export const MARKETING_CATEGORIES = [
  ["creative", "Creative"],
  ["social", "Social"],
  ["online_advertising", "Online Advertising"],
  ["sponsorship", "Sponsorship"],
  ["advertising", "Advertising"],
  ["production", "Production"],
] as const;

export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number][0];

export const MARKETING_CATEGORY_LABELS = Object.fromEntries(MARKETING_CATEGORIES) as Record<MarketingCategory, string>;

export const MARKETING_CATEGORY_STYLES: Record<MarketingCategory, string> = {
  creative: "bg-fuchsia-50 text-fuchsia-800",
  social: "bg-sky-50 text-sky-800",
  online_advertising: "bg-violet-50 text-violet-800",
  sponsorship: "bg-amber-50 text-amber-900",
  advertising: "bg-indigo-50 text-indigo-800",
  production: "bg-teal-50 text-teal-800",
};

/** Paid reach: these count toward an event's ad budget on the promotion timeline. */
export const AD_CATEGORIES: MarketingCategory[] = ["online_advertising", "advertising", "social"];

export const DELIVERY_TIMINGS = [
  ["1_week", "1 week before"],
  ["2_weeks", "2 weeks before"],
  ["1_month", "1 month before"],
  ["custom", "Custom date"],
] as const;

export type DeliveryTiming = (typeof DELIVERY_TIMINGS)[number][0];

export function isMarketingCategory(value: unknown): value is MarketingCategory {
  return MARKETING_CATEGORIES.some(([key]) => key === value);
}

export function isDeliveryTiming(value: unknown): value is DeliveryTiming {
  return DELIVERY_TIMINGS.some(([key]) => key === value);
}

/** When an item is due, from the event's Calgary date (YYYY-MM-DD). */
export function deliveryDate(eventDay: string | null, timing: DeliveryTiming | null, customDay: string | null): string | null {
  if (timing === "custom") return customDay;
  if (!timing || !eventDay) return null;
  const d = new Date(`${eventDay}T00:00:00Z`);
  if (timing === "1_week") d.setUTCDate(d.getUTCDate() - 7);
  else if (timing === "2_weeks") d.setUTCDate(d.getUTCDate() - 14);
  else {
    // A month before, clamped to the end of a shorter month (Mar 31 -> Feb 28).
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}
