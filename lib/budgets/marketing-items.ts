/** Who a marketing item is for: general Catapult marketing, an event, or a sponsor. */
export const MARKETING_STREAMS = [
  ["catapult", "Catapult"],
  ["event", "Event"],
  ["sponsorship", "Sponsorship"],
] as const;

export type MarketingStream = (typeof MARKETING_STREAMS)[number][0];

export const MARKETING_STREAM_STYLES: Record<MarketingStream, string> = {
  catapult: "bg-brand-50 text-brand-800",
  event: "bg-sky-50 text-sky-800",
  sponsorship: "bg-amber-50 text-amber-900",
};

/** The kind of marketing work, the same list for every stream. */
export const MARKETING_CATEGORIES = [
  ["social", "Social"],
  ["online_advertising", "Online Advertising"],
  ["production", "Production"],
  ["creative", "Creative"],
] as const;

export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number][0];

/** Labels include the two older categories, so costs saved before the change still read well. */
export const MARKETING_CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(MARKETING_CATEGORIES),
  advertising: "Online Advertising",
  sponsorship: "Sponsorship",
};

export const MARKETING_CATEGORY_STYLES: Record<string, string> = {
  social: "bg-sky-50 text-sky-800",
  online_advertising: "bg-violet-50 text-violet-800",
  production: "bg-teal-50 text-teal-800",
  creative: "bg-fuchsia-50 text-fuchsia-800",
  advertising: "bg-violet-50 text-violet-800",
  sponsorship: "bg-amber-50 text-amber-900",
};

/** Paid reach: these count toward an event's ad budget on the promotion timeline. */
export const AD_CATEGORIES: string[] = ["online_advertising", "advertising", "social"];

export const MARKETING_STATUSES = [
  ["planned", "Planned"],
  ["in_progress", "In progress"],
  ["done", "Done"],
] as const;

export type MarketingStatus = (typeof MARKETING_STATUSES)[number][0];

export const MARKETING_STATUS_STYLES: Record<MarketingStatus, string> = {
  planned: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-50 text-amber-800",
  done: "bg-emerald-50 text-emerald-800",
};

export const DELIVERY_TIMINGS = [
  ["1_week", "1 week before"],
  ["2_weeks", "2 weeks before"],
  ["1_month", "1 month before"],
  ["custom", "Custom date"],
] as const;

export type DeliveryTiming = (typeof DELIVERY_TIMINGS)[number][0];

export function isMarketingStream(value: unknown): value is MarketingStream {
  return MARKETING_STREAMS.some(([key]) => key === value);
}

export function isMarketingCategory(value: unknown): value is MarketingCategory {
  return MARKETING_CATEGORIES.some(([key]) => key === value);
}

export function isMarketingStatus(value: unknown): value is MarketingStatus {
  return MARKETING_STATUSES.some(([key]) => key === value);
}

export function isDeliveryTiming(value: unknown): value is DeliveryTiming {
  return DELIVERY_TIMINGS.some(([key]) => key === value);
}

/** When an item is due, from the event's Calgary date (YYYY-MM-DD). Without an event, only a custom date counts. */
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
