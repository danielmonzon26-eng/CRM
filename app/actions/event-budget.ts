"use server";

import { revalidatePath } from "next/cache";
import { getBudgetList, getSelectedBudgetId } from "@/lib/budgets/queries";
import { isDeliveryTiming, isMarketingCategory, MARKETING_CATEGORY_LABELS, type DeliveryTiming, type MarketingCategory } from "@/lib/budgets/marketing-items";
import { calgaryDateKey } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

export type EventBudget = {
  linked: {
    lineId: string;
    lineName: string;
    budgetId: string;
    budgetName: string;
    section: string;
    planMonth: string | null;
    amount: number;
    /** What the budget sets aside for the event; null when not set yet. */
    plannedAmount: number | null;
    spent: number;
    items: {
      id: string;
      name: string;
      amount: number;
      spent: number;
      category: MarketingCategory | null;
      timing: DeliveryTiming | null;
      deliveryOn: string | null;
    }[];
  } | null;
  /** The event's Calgary date, for working out marketing delivery dates. */
  eventDay: string | null;
  /** The event's marketing items (the unified list), with what's been spent on each. */
  marketingItems: {
    id: string;
    name: string;
    description: string;
    amount: number;
    spent: number;
    category: MarketingCategory;
    timing: DeliveryTiming | null;
    deliveryOn: string | null;
  }[];
  budgets: { id: string; name: string; periodLabel: string | null; sections: string[] }[];
  defaultBudgetId: string | null;
  unlinkedLines: { id: string; name: string; amount: number; budgetId: string; budgetName: string; section: string }[];
};

function revalidate(eventId: string, lineId?: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/events");
  revalidatePath("/budgets", "layout");
  revalidatePath("/");
  revalidatePath("/marketing", "layout");
  if (lineId) revalidatePath(`/budgets/lines/${lineId}`);
}

/** Everything the wizard's Budget step needs: the linked line and its items, or the choices for linking one. */
export async function loadEventBudget(eventId: string): Promise<EventBudget> {
  const supabase = await createClient();
  const [{ data: line }, budgets, defaultBudgetId, { data: allLines }, { data: event }] = await Promise.all([
    supabase.from("budget_lines").select("id, budget_id, section, name, plan_month, amount, planned_amount").eq("event_id", eventId).maybeSingle(),
    getBudgetList(),
    getSelectedBudgetId(),
    supabase.from("budget_lines").select("id, budget_id, kind, section, name, amount, event_id"),
    supabase.from("events").select("starts_at").eq("id", eventId).maybeSingle(),
  ]);
  const { data: mItems } = await supabase
    .from("marketing_items")
    .select("id, description, amount, item_type, delivery_timing, delivery_on, budget_item_id")
    .eq("event_id", eventId)
    .order("created_at");
  const budgetName = new Map(budgets.map((b) => [b.id, b.name]));

  let linked: EventBudget["linked"] = null;
  if (line) {
    const [{ data: items }, { data: expenses }] = await Promise.all([
      supabase.from("budget_items").select("id, name, amount, marketing_category, delivery_timing, delivery_on").eq("line_id", line.id).order("sort_order"),
      supabase.from("budget_expenses").select("item_id, amount").eq("line_id", line.id),
    ]);
    const spentByItem = new Map<string, number>();
    for (const e of expenses ?? []) if (e.item_id) spentByItem.set(e.item_id, (spentByItem.get(e.item_id) ?? 0) + Number(e.amount));
    linked = {
      lineId: line.id,
      lineName: line.name,
      budgetId: line.budget_id,
      budgetName: budgetName.get(line.budget_id) ?? "Budget",
      section: line.section,
      planMonth: line.plan_month,
      amount: Number(line.amount),
      plannedAmount: line.planned_amount === null ? null : Number(line.planned_amount),
      spent: (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0),
      items: (items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        amount: Number(i.amount),
        spent: spentByItem.get(i.id) ?? 0,
        category: isMarketingCategory(i.marketing_category) ? i.marketing_category : null,
        timing: isDeliveryTiming(i.delivery_timing) ? i.delivery_timing : null,
        deliveryOn: i.delivery_on,
      })),
    };
  }

  const spentByBudgetItem = new Map((linked?.items ?? []).map((i) => [i.id, i.spent]));
  return {
    linked,
    eventDay: event?.starts_at ? calgaryDateKey(event.starts_at) : null,
    marketingItems: (mItems ?? []).map((m) => ({
      id: m.id,
      name: m.description.trim() || MARKETING_CATEGORY_LABELS[m.item_type],
      description: m.description,
      amount: Number(m.amount),
      spent: m.budget_item_id ? spentByBudgetItem.get(m.budget_item_id) ?? 0 : 0,
      category: m.item_type,
      timing: isDeliveryTiming(m.delivery_timing) ? m.delivery_timing : null,
      deliveryOn: m.delivery_on,
    })),
    budgets: budgets.map((b) => ({
      ...b,
      sections: [...new Set((allLines ?? []).filter((l) => l.budget_id === b.id && l.kind === "event").map((l) => l.section))].sort(),
    })),
    defaultBudgetId,
    unlinkedLines: (allLines ?? [])
      .filter((l) => l.kind === "event" && !l.event_id)
      .map((l) => ({ id: l.id, name: l.name, amount: Number(l.amount), budgetId: l.budget_id, budgetName: budgetName.get(l.budget_id) ?? "Budget", section: l.section })),
  };
}

/**
 * Creates this event's line in a budget, planned in the event's month (or the nearest month
 * the budget covers), links it, and adds any starting items.
 */
export async function createEventBudgetLine(input: {
  eventId: string;
  budgetId: string;
  section: string;
  items: { name: string; amount: number; category?: string | null; timing?: string | null; deliveryOn?: string | null }[];
  /** What the budget sets aside for the event. */
  setAside?: number | null;
}): Promise<Result & { lineId?: string }> {
  const section = input.section.trim();
  if (!section) return { error: "Choose or type a section, such as Events." };
  if (input.items.some((i) => !i.name.trim() || !Number.isFinite(i.amount) || i.amount < 0)) return { error: "Check the item names and amounts." };
  for (const i of input.items) {
    const problem = marketingProblem(i.category ?? null, i.timing ?? null, i.deliveryOn ?? null);
    if (problem) return { error: problem };
  }

  const supabase = await createClient();
  const [{ data: event }, { data: budget }, { data: existing }] = await Promise.all([
    supabase.from("events").select("title, starts_at").eq("id", input.eventId).maybeSingle(),
    supabase.from("budgets").select("start_month, end_month").eq("id", input.budgetId).maybeSingle(),
    supabase.from("budget_lines").select("id").eq("event_id", input.eventId).maybeSingle(),
  ]);
  if (!event) return { error: "Save the event first." };
  if (!budget) return { error: "That budget wasn't found." };
  if (existing) return { error: "This event already has a budget line." };

  const eventMonth = `${new Date(event.starts_at).toLocaleDateString("en-CA", { timeZone: "America/Edmonton" }).slice(0, 7)}-01`;
  let planMonth = eventMonth;
  if (budget.start_month && planMonth < budget.start_month) planMonth = budget.start_month;
  if (budget.end_month && planMonth > budget.end_month) planMonth = budget.end_month;

  const { data: lineId, error } = await supabase.rpc("budget_add_line", {
    p_budget_id: input.budgetId,
    p_kind: "event",
    p_section: section,
    p_name: event.title,
    p_plan_month: planMonth,
  });
  if (error || !lineId) return { error: "The budget line wasn't created. Please try again." };

  const { error: linkError } = await supabase.from("budget_lines").update({ event_id: input.eventId }).eq("id", lineId);
  if (linkError) {
    await supabase.from("budget_lines").delete().eq("id", lineId);
    return { error: "The budget line wasn't linked. Please try again." };
  }
  if (input.setAside != null && Number.isFinite(input.setAside) && input.setAside >= 0) {
    await supabase.from("budget_lines").update({ planned_amount: Math.round(input.setAside * 100) / 100 }).eq("id", lineId);
  }

  if (input.items.length) {
    const { error: itemsError } = await supabase
      .from("budget_items")
      .insert(
        input.items
          .filter((item) => !item.category)
          .map((item, i) => ({ line_id: lineId, name: item.name.trim(), amount: item.amount, sort_order: i + 1 })),
      );
    if (itemsError) return { error: "The line was created, but some items didn't save. Add them again below.", lineId };
    // Marketing costs go in as marketing items; each puts its own cost on the line.
    const marketing = input.items.filter((item) => item.category && isMarketingCategory(item.category));
    if (marketing.length) {
      const { error: marketingError } = await supabase.from("marketing_items").insert(
        marketing.map((item) => ({
          stream: "event" as const,
          item_type: item.category as MarketingCategory,
          description: item.name.trim() === MARKETING_CATEGORY_LABELS[item.category!] ? "" : item.name.trim(),
          event_id: input.eventId,
          amount: item.amount,
          budget_line_id: lineId,
          ...(() => {
            const c = marketingColumns(item.category ?? null, item.timing ?? null, item.deliveryOn ?? null);
            return { delivery_timing: c.delivery_timing, delivery_on: c.delivery_on };
          })(),
        })),
      );
      if (marketingError) return { error: "The line was created, but the marketing items didn't save. Add them again below.", lineId };
    }
  }

  revalidate(input.eventId, lineId);
  return { lineId };
}

/** Links a line someone already made under Budgets, or unlinks with null. */
export async function setEventBudgetLine(eventId: string, lineId: string | null): Promise<Result> {
  const supabase = await createClient();
  if (lineId) {
    const { data: line, error } = await supabase.from("budget_lines").update({ event_id: eventId }).eq("id", lineId).is("event_id", null).select("amount, planned_amount").single();
    if (error || !line) return { error: error?.code === "23505" ? "This event already has a budget line." : "That line is already linked to another event." };
    // A line planned under Budgets keeps its amount as what's set aside for the event.
    if (line.planned_amount === null) await supabase.from("budget_lines").update({ planned_amount: line.amount }).eq("id", lineId);
    await supabase.from("events").update({ budget_amount: line.amount }).eq("id", eventId);
    revalidate(eventId, lineId);
    return {};
  }
  const { data: line, error } = await supabase.from("budget_lines").update({ event_id: null }).eq("event_id", eventId).select("id").maybeSingle();
  if (error) return { error: "The line wasn't unlinked. Please try again." };
  revalidate(eventId, line?.id);
  return {};
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves the event to another event line, with its costs, marketing items and spending.
 * The old line stays in its budget, empty.
 */
export async function moveEventBudgetLine(eventId: string, lineId: string): Promise<Result> {
  if (!UUID.test(eventId) || !UUID.test(lineId)) return { error: "Choose a line from the list." };
  const supabase = await createClient();
  const { data: from } = await supabase.from("budget_lines").select("id").eq("event_id", eventId).maybeSingle();
  const { error } = await supabase.rpc("move_event_budget_line", { p_event_id: eventId, p_to_line: lineId });
  if (error) {
    if (error.code === "23505") return { error: "That line is already linked to another event. Pick another one." };
    if (error.code === "P0002") return { error: error.message };
    if (error.code === "42501") return { error: "You don't have permission to change budgets." };
    return { error: "The event wasn't moved. Please try again." };
  }
  revalidate(eventId, lineId);
  if (from?.id) revalidatePath(`/budgets/lines/${from.id}`);
  return {};
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function marketingProblem(category: string | null, timing: string | null, deliveryOn: string | null): string | null {
  if (!category) return null;
  if (!isMarketingCategory(category)) return "Choose a marketing category from the list.";
  if (timing && !isDeliveryTiming(timing)) return "Choose when it needs to be delivered.";
  if (timing === "custom" && !(deliveryOn && DAY.test(deliveryOn))) return "Pick the delivery date.";
  return null;
}

function marketingColumns(category: string | null, timing: string | null, deliveryOn: string | null) {
  if (!category || !isMarketingCategory(category)) return { marketing_category: null, delivery_timing: null, delivery_on: null };
  const t = timing && isDeliveryTiming(timing) ? timing : null;
  return { marketing_category: category, delivery_timing: t, delivery_on: t === "custom" ? deliveryOn : null };
}

/**
 * A marketing item on the event's budget line: its category, a description, the amount
 * and when it's needed. Its name is the description (or the category when blank).
 */
export async function saveMarketingItem(input: {
  eventId: string;
  lineId: string;
  itemId: string | null;
  category: string;
  description: string;
  amount: string;
  timing: string;
  deliveryOn: string;
}): Promise<Result> {
  if (!isMarketingCategory(input.category)) return { error: "Choose the item: Social, Online Advertising, Production or Creative." };
  const problem = marketingProblem(input.category, input.timing || null, input.deliveryOn || null);
  if (problem) return { error: problem };
  const amount = input.amount.trim() === "" ? 0 : Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the amount in dollars, or leave it blank." };
  const c = marketingColumns(input.category, input.timing || null, input.deliveryOn || null);
  const values = {
    item_type: input.category,
    description: input.description.trim().slice(0, 200),
    amount: Math.round(amount * 100) / 100,
    delivery_timing: c.delivery_timing,
    delivery_on: c.delivery_on,
  };

  const supabase = await createClient();
  const { error } = input.itemId
    ? await supabase.from("marketing_items").update(values).eq("id", input.itemId).eq("event_id", input.eventId)
    : await supabase.from("marketing_items").insert({ ...values, stream: "event", event_id: input.eventId, budget_line_id: input.lineId });
  if (error) return { error: "That didn't save. Please try again." };
  revalidate(input.eventId, input.lineId);
  return {};
}

/** Removes a marketing item and, with it, its cost on the line. */
export async function deleteEventMarketingItem(eventId: string, itemId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("marketing_items").delete().eq("id", itemId).eq("event_id", eventId);
  if (error) return { error: "That wasn't deleted. Please try again." };
  revalidate(eventId);
  return {};
}

/** Sets (or clears) what the budget sets aside for the event. */
export async function setEventSetAside(eventId: string, lineId: string, amount: string): Promise<Result> {
  const value = amount.trim() === "" ? null : Number(amount);
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Enter the amount in dollars, or leave it blank." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_lines")
    .update({ planned_amount: value === null ? null : Math.round(value * 100) / 100 })
    .eq("id", lineId)
    .eq("event_id", eventId)
    .select("id")
    .single();
  if (error) return { error: "That didn't save. Please try again." };
  revalidate(eventId, lineId);
  return {};
}
