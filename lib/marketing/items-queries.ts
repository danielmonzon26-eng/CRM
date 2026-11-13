import { deliveryDate, isDeliveryTiming, type DeliveryTiming, type MarketingCategory, type MarketingStatus, type MarketingStream } from "@/lib/budgets/marketing-items";
import { calgaryDateKey, EVENT_TIME_ZONE } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

const eventDayFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE });

export type MarketingItem = {
  id: string;
  stream: MarketingStream;
  type: MarketingCategory;
  description: string;
  /** The description, or the type when there isn't one. */
  name: string;
  amount: number;
  timing: DeliveryTiming | null;
  deliveryOn: string | null;
  /** When it's due, YYYY-MM-DD, worked out from the event for event-relative timings. */
  due: string | null;
  status: MarketingStatus;
  /** Kept for the overview's wording: done means delivered. */
  delivered: boolean;
  event: { id: string; title: string; day: string; whenLabel: string } | null;
  sponsor: { id: string; name: string } | null;
  budgetLine: { id: string; name: string; budgetId: string; budgetName: string } | null;
};

export type ItemOptions = {
  events: { id: string; title: string; day: string; whenLabel: string; lineId: string | null }[];
  lines: { id: string; name: string; budgetName: string; section: string; eventId: string | null }[];
  sponsors: { id: string; name: string }[];
};

const TYPE_LABEL: Record<string, string> = { social: "Social", online_advertising: "Online Advertising", production: "Production", creative: "Creative", event_materials: "Event Materials", onsite_advertising: "Onsite Advertising", newsletter: "Newsletter/eBlast" };

/** Every marketing item, optionally only one event's. */
export async function getMarketingItems(options: { eventId?: string } = {}): Promise<MarketingItem[]> {
  const supabase = await createClient();
  let query = supabase.from("marketing_items").select("*");
  if (options.eventId) query = query.eq("event_id", options.eventId);
  const { data: items, error } = await query.order("created_at");
  if (error) throw error;
  if (!items?.length) return [];

  const eventIds = [...new Set(items.map((i) => i.event_id).filter((x): x is string => !!x))];
  const sponsorIds = [...new Set(items.map((i) => i.sponsor_company_id).filter((x): x is string => !!x))];
  const lineIds = [...new Set(items.map((i) => i.budget_line_id).filter((x): x is string => !!x))];
  const [events, sponsors, lines] = await Promise.all([
    eventIds.length ? supabase.from("events").select("id, title, starts_at").in("id", eventIds) : Promise.resolve({ data: [], error: null }),
    sponsorIds.length ? supabase.from("companies").select("id, name").in("id", sponsorIds) : Promise.resolve({ data: [], error: null }),
    lineIds.length ? supabase.from("budget_lines").select("id, name, budget_id").in("id", lineIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [events, sponsors, lines]) if (r.error) throw r.error;
  const budgetIds = [...new Set((lines.data ?? []).map((l) => (l as { budget_id: string }).budget_id))];
  const { data: budgets, error: budgetsError } = budgetIds.length ? await supabase.from("budgets").select("id, name").in("id", budgetIds) : { data: [], error: null };
  if (budgetsError) throw budgetsError;

  const eventById = new Map((events.data ?? []).map((e) => [e.id, e as { id: string; title: string; starts_at: string }]));
  const sponsorById = new Map((sponsors.data ?? []).map((c) => [c.id, c as { id: string; name: string }]));
  const budgetName = new Map((budgets ?? []).map((b) => [b.id, b.name]));
  const lineById = new Map((lines.data ?? []).map((l) => [l.id, l as { id: string; name: string; budget_id: string }]));

  return items
    .map((i): MarketingItem => {
      const ev = i.event_id ? eventById.get(i.event_id) : undefined;
      const day = ev ? calgaryDateKey(ev.starts_at) : null;
      const timing = isDeliveryTiming(i.delivery_timing) ? i.delivery_timing : null;
      const line = i.budget_line_id ? lineById.get(i.budget_line_id) : undefined;
      return {
        id: i.id,
        stream: i.stream,
        type: i.item_type,
        description: i.description,
        name: i.description.trim() || TYPE_LABEL[i.item_type],
        amount: Number(i.amount),
        timing,
        deliveryOn: i.delivery_on,
        due: deliveryDate(day, timing, i.delivery_on),
        status: i.status,
        delivered: i.status === "done",
        event: ev && day ? { id: ev.id, title: ev.title, day, whenLabel: eventDayFormat.format(new Date(ev.starts_at)) } : null,
        sponsor: i.sponsor_company_id ? sponsorById.get(i.sponsor_company_id) ?? null : null,
        budgetLine: line ? { id: line.id, name: line.name, budgetId: line.budget_id, budgetName: budgetName.get(line.budget_id) ?? "Budget" } : null,
      };
    })
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.name.localeCompare(b.name));
}

/** Choices for the table's dropdowns: upcoming events, budget lines, and sponsor companies already used. */
export async function getItemOptions(now = new Date()): Promise<ItemOptions> {
  const supabase = await createClient();
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const [{ data: events, error: eventsError }, { data: lines, error: linesError }, { data: budgets, error: budgetsError }, { data: used, error: usedError }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at").is("archived_at", null).neq("status", "cancelled").gte("starts_at", since).order("starts_at").limit(200),
    supabase.from("budget_lines").select("id, name, budget_id, section, event_id").order("sort_order").limit(1000),
    supabase.from("budgets").select("id, name").order("created_at", { ascending: false }),
    supabase.from("marketing_items").select("sponsor_company_id").not("sponsor_company_id", "is", null),
  ]);
  for (const e of [eventsError, linesError, budgetsError, usedError]) if (e) throw e;
  const budgetName = new Map((budgets ?? []).map((b) => [b.id, b.name]));
  const sponsorIds = [...new Set((used ?? []).map((u) => u.sponsor_company_id!))];
  const { data: sponsors } = sponsorIds.length ? await supabase.from("companies").select("id, name").in("id", sponsorIds) : { data: [] };
  return {
    events: (events ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      day: calgaryDateKey(e.starts_at),
      whenLabel: eventDayFormat.format(new Date(e.starts_at)),
      lineId: (lines ?? []).find((l) => l.event_id === e.id)?.id ?? null,
    })),
    lines: (lines ?? []).map((l) => ({ id: l.id, name: l.name, budgetName: budgetName.get(l.budget_id) ?? "Budget", section: l.section, eventId: l.event_id })),
    sponsors: (sponsors ?? []).map((c) => ({ id: c.id, name: c.name })),
  };
}
