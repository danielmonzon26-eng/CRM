"use server";

import { revalidatePath } from "next/cache";
import { getBudgetList, getSelectedBudgetId } from "@/lib/budgets/queries";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

export type EventBudget = {
  linked: {
    lineId: string;
    budgetId: string;
    budgetName: string;
    section: string;
    planMonth: string | null;
    amount: number;
    spent: number;
    items: { id: string; name: string; amount: number; spent: number }[];
  } | null;
  budgets: { id: string; name: string; periodLabel: string | null; sections: string[] }[];
  defaultBudgetId: string | null;
  unlinkedLines: { id: string; name: string; amount: number; budgetName: string }[];
};

function revalidate(eventId: string, lineId?: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/events");
  revalidatePath("/budgets", "layout");
  revalidatePath("/");
  if (lineId) revalidatePath(`/budgets/lines/${lineId}`);
}

/** Everything the wizard's Budget step needs: the linked line and its items, or the choices for linking one. */
export async function loadEventBudget(eventId: string): Promise<EventBudget> {
  const supabase = await createClient();
  const [{ data: line }, budgets, defaultBudgetId, { data: allLines }] = await Promise.all([
    supabase.from("budget_lines").select("id, budget_id, section, plan_month, amount").eq("event_id", eventId).maybeSingle(),
    getBudgetList(),
    getSelectedBudgetId(),
    supabase.from("budget_lines").select("id, budget_id, kind, section, name, amount, event_id"),
  ]);
  const budgetName = new Map(budgets.map((b) => [b.id, b.name]));

  let linked: EventBudget["linked"] = null;
  if (line) {
    const [{ data: items }, { data: expenses }] = await Promise.all([
      supabase.from("budget_items").select("id, name, amount").eq("line_id", line.id).order("sort_order"),
      supabase.from("budget_expenses").select("item_id, amount").eq("line_id", line.id),
    ]);
    const spentByItem = new Map<string, number>();
    for (const e of expenses ?? []) if (e.item_id) spentByItem.set(e.item_id, (spentByItem.get(e.item_id) ?? 0) + Number(e.amount));
    linked = {
      lineId: line.id,
      budgetId: line.budget_id,
      budgetName: budgetName.get(line.budget_id) ?? "Budget",
      section: line.section,
      planMonth: line.plan_month,
      amount: Number(line.amount),
      spent: (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0),
      items: (items ?? []).map((i) => ({ id: i.id, name: i.name, amount: Number(i.amount), spent: spentByItem.get(i.id) ?? 0 })),
    };
  }

  return {
    linked,
    budgets: budgets.map((b) => ({
      ...b,
      sections: [...new Set((allLines ?? []).filter((l) => l.budget_id === b.id && l.kind === "event").map((l) => l.section))].sort(),
    })),
    defaultBudgetId,
    unlinkedLines: (allLines ?? [])
      .filter((l) => l.kind === "event" && !l.event_id)
      .map((l) => ({ id: l.id, name: l.name, amount: Number(l.amount), budgetName: budgetName.get(l.budget_id) ?? "Budget" })),
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
  items: { name: string; amount: number }[];
}): Promise<Result & { lineId?: string }> {
  const section = input.section.trim();
  if (!section) return { error: "Choose or type a section, such as Events." };
  if (input.items.some((i) => !i.name.trim() || !Number.isFinite(i.amount) || i.amount < 0)) return { error: "Check the item names and amounts." };

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

  if (input.items.length) {
    const { error: itemsError } = await supabase
      .from("budget_items")
      .insert(input.items.map((item, i) => ({ line_id: lineId, name: item.name.trim(), amount: item.amount, sort_order: i + 1 })));
    if (itemsError) return { error: "The line was created, but some items didn't save. Add them again below.", lineId };
  }

  revalidate(input.eventId, lineId);
  return { lineId };
}

/** Links a line someone already made under Budgets, or unlinks with null. */
export async function setEventBudgetLine(eventId: string, lineId: string | null): Promise<Result> {
  const supabase = await createClient();
  if (lineId) {
    const { data: line, error } = await supabase.from("budget_lines").update({ event_id: eventId }).eq("id", lineId).is("event_id", null).select("amount").single();
    if (error || !line) return { error: error?.code === "23505" ? "This event already has a budget line." : "That line is already linked to another event." };
    await supabase.from("events").update({ budget_amount: line.amount }).eq("id", eventId);
    revalidate(eventId, lineId);
    return {};
  }
  const { data: line, error } = await supabase.from("budget_lines").update({ event_id: null }).eq("event_id", eventId).select("id").maybeSingle();
  if (error) return { error: "The line wasn't unlinked. Please try again." };
  revalidate(eventId, line?.id);
  return {};
}
