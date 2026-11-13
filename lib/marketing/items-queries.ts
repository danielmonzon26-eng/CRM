import { deliveryDate, isDeliveryTiming, isMarketingCategory, type DeliveryTiming, type MarketingCategory } from "@/lib/budgets/marketing-items";
import { calgaryDateKey, EVENT_TIME_ZONE } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

const eventDayFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE });

export type MarketingItem = {
  id: string;
  lineId: string;
  name: string;
  category: MarketingCategory;
  amount: number;
  timing: DeliveryTiming | null;
  /** When it's needed, YYYY-MM-DD; null when no timing was chosen. */
  due: string | null;
  delivered: boolean;
  event: { id: string; title: string; day: string; whenLabel: string };
};

/** Marketing items booked on event budgets, for events from 30 days ago onward. */
export async function getMarketingItems(now = new Date()): Promise<MarketingItem[]> {
  const supabase = await createClient();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data: events, error } = await supabase.from("events").select("id, title, starts_at, status").is("archived_at", null).neq("status", "cancelled").gte("starts_at", since);
  if (error) throw error;
  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) return [];
  const { data: lines, error: linesError } = await supabase.from("budget_lines").select("id, event_id").in("event_id", eventIds);
  if (linesError) throw linesError;
  const lineIds = (lines ?? []).map((l) => l.id);
  if (lineIds.length === 0) return [];
  const { data: items, error: itemsError } = await supabase
    .from("budget_items")
    .select("id, line_id, name, amount, marketing_category, delivery_timing, delivery_on, delivered_at")
    .in("line_id", lineIds)
    .not("marketing_category", "is", null);
  if (itemsError) throw itemsError;

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const eventByLine = new Map((lines ?? []).map((l) => [l.id, eventById.get(l.event_id!)]));
  return (items ?? [])
    .flatMap((i) => {
      const ev = eventByLine.get(i.line_id);
      if (!ev || !isMarketingCategory(i.marketing_category)) return [];
      const day = calgaryDateKey(ev.starts_at);
      const timing = isDeliveryTiming(i.delivery_timing) ? i.delivery_timing : null;
      return [
        {
          id: i.id,
          lineId: i.line_id,
          name: i.name,
          category: i.marketing_category,
          amount: Number(i.amount),
          timing,
          due: deliveryDate(day, timing, i.delivery_on),
          delivered: !!i.delivered_at,
          event: { id: ev.id, title: ev.title, day, whenLabel: eventDayFormat.format(new Date(ev.starts_at)) },
        },
      ];
    })
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.event.day.localeCompare(b.event.day));
}
