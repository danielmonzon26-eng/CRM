"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { monthLabel } from "@/lib/budgets/history";
import { BUDGET_COOKIE } from "@/lib/budgets/queries";
import { createClient } from "@/lib/supabase/server";
import type { BudgetRevenueKind, BudgetRevenueStatus, ExpenseStatus } from "@/lib/supabase/types";

export type BudgetActionResult = { error?: string; id?: string };

const MAX_BUDGET_MONTHS = 36;
const SELECTION_SECONDS = 60 * 60 * 24 * 365;

function revalidateBudgets(lineId?: string) {
  revalidatePath("/");
  revalidatePath("/budgets", "layout");
  revalidatePath("/reports");
  revalidatePath("/events");
  revalidatePath("/events/[id]", "page");
  if (lineId) revalidatePath(`/budgets/lines/${lineId}`);
}

async function rememberBudget(budgetId: string) {
  (await cookies()).set(BUDGET_COOKIE, budgetId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SELECTION_SECONDS,
  });
}

/** Remembers which budget this person is looking at, here and on the Overview. */
export async function selectBudget(budgetId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").select("id").eq("id", budgetId).single();
  if (error) return { error: "That budget couldn't be opened." };
  await rememberBudget(budgetId);
  revalidateBudgets();
  return {};
}

export async function createBudget(input: { name: string; startMonth: string; endMonth: string }): Promise<BudgetActionResult> {
  const name = input.name.trim();
  const isMonth = (value: string) => /^\d{4}-\d{2}-01$/.test(value);
  if (!name) return { error: "Name this budget." };
  if (!isMonth(input.startMonth) || !isMonth(input.endMonth)) return { error: "Choose a start and end month." };
  if (input.startMonth > input.endMonth) return { error: "The end month can't be before the start month." };

  const [startYear, startMonth] = input.startMonth.split("-").map(Number);
  const [endYear, endMonth] = input.endMonth.split("-").map(Number);
  const count = (endYear - startYear) * 12 + endMonth - startMonth + 1;
  if (count > MAX_BUDGET_MONTHS) return { error: `A budget can cover up to ${MAX_BUDGET_MONTHS} months.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const periodLabel = `${monthLabel(input.startMonth)} – ${monthLabel(input.endMonth)} (${count} ${count === 1 ? "month" : "months"})`;
  const { data, error } = await supabase
    .from("budgets")
    .insert({ name, period_label: periodLabel, start_month: input.startMonth, end_month: input.endMonth, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `"${name}" already exists for these months.` };
    return { error: error.message };
  }

  await rememberBudget(data.id);
  revalidateBudgets();
  return { id: data.id };
}

export async function linkBudgetLine(lineId: string, eventId: string | null): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { data: line, error: lineError } = await supabase
    .from("budget_lines")
    .update({ event_id: eventId })
    .eq("id", lineId)
    .select("amount")
    .single();
  if (lineError) {
    if (lineError.code === "23505") return { error: "That event is already linked to another budget line." };
    return { error: lineError.message };
  }

  // Keeps the amount shown on the Events list in step with the approved budget.
  if (eventId) {
    const { error } = await supabase.from("events").update({ budget_amount: line.amount }).eq("id", eventId);
    if (error) return { error: error.message };
  }

  revalidateBudgets(lineId);
  return {};
}

export async function addBudgetExpense(input: {
  lineId: string;
  itemId: string | null;
  status: ExpenseStatus;
  amount: string;
  incurredOn: string;
  vendor: string;
  description: string;
}): Promise<BudgetActionResult> {
  const amount = Number(input.amount);
  if (!input.amount.trim() || !Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero." };
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return { error: "Use dollars and cents, like 125.50." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.incurredOn)) return { error: "Choose a date." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("budget_expenses").insert({
    line_id: input.lineId,
    item_id: input.itemId || null,
    status: input.status,
    amount,
    incurred_on: input.incurredOn,
    vendor: input.vendor.trim() || null,
    description: input.description.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidateBudgets(input.lineId);
  return {};
}

export async function deleteBudgetExpense(expenseId: string, lineId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_expenses").delete().eq("id", expenseId).select("id").single();
  if (error) return { error: error.message };
  revalidateBudgets(lineId);
  return {};
}

function parseAmount(value: string | number): number | null {
  const amount = typeof value === "number" ? value : Number(value.trim() === "" ? NaN : value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9_999_999_999) return null;
  return Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 ? null : amount;
}

const AMOUNT_ERROR = "Enter an amount in dollars and cents, like 125.50.";

async function refreshAfter(error: { message: string } | null, lineId?: string): Promise<BudgetActionResult> {
  if (error) return { error: error.message };
  revalidateBudgets(lineId);
  return {};
}

export async function setLineMonth(lineId: string, month: string, value: string): Promise<BudgetActionResult> {
  const amount = parseAmount(value);
  if (amount === null) return { error: AMOUNT_ERROR };
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_allocations")
    .upsert({ line_id: lineId, month, amount }, { onConflict: "line_id,month" });
  return refreshAfter(error, lineId);
}

/** Spreads a general line's total evenly, with any leftover cents in the last month. */
export async function splitLineEvenly(lineId: string, months: string[], value: string): Promise<BudgetActionResult> {
  const total = parseAmount(value);
  if (total === null) return { error: AMOUNT_ERROR };
  if (months.length === 0) return { error: "This budget has no months." };

  const cents = Math.round(total * 100);
  const share = Math.floor(cents / months.length);
  const rows = months.map((month, i) => ({
    line_id: lineId,
    month,
    amount: (i === months.length - 1 ? cents - share * (months.length - 1) : share) / 100,
  }));

  const supabase = await createClient();
  const { error } = await supabase.from("budget_allocations").upsert(rows, { onConflict: "line_id,month" });
  return refreshAfter(error, lineId);
}

export async function updateBudgetLine(
  lineId: string,
  input: { name: string; section: string; ownerName: string; notes: string; planMonth: string | null }
): Promise<BudgetActionResult> {
  const name = input.name.trim();
  const section = input.section.trim();
  if (!name) return { error: "Name this line." };
  if (!section) return { error: "Choose a section." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_lines")
    .update({
      name,
      section,
      owner_name: input.ownerName.trim() || null,
      notes: input.notes.trim() || null,
      ...(input.planMonth ? { plan_month: input.planMonth } : {}),
    })
    .eq("id", lineId)
    .select("id")
    .single();
  return refreshAfter(error, lineId);
}

export async function renameBudgetLine(lineId: string, name: string): Promise<BudgetActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name this line." };
  const supabase = await createClient();
  const { error } = await supabase.from("budget_lines").update({ name: trimmed }).eq("id", lineId).select("id").single();
  return refreshAfter(error, lineId);
}

export async function addBudgetLine(input: {
  budgetId: string;
  kind: "general" | "event";
  section: string;
  name: string;
  planMonth: string | null;
}): Promise<BudgetActionResult> {
  const name = input.name.trim();
  const section = input.section.trim();
  if (!name) return { error: "Name this line." };
  if (!section) return { error: "Choose or type a section." };
  if (input.kind === "event" && !input.planMonth) return { error: "Choose the month this event's money is planned in." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("budget_add_line", {
    p_budget_id: input.budgetId,
    p_kind: input.kind,
    p_section: section,
    p_name: name,
    p_plan_month: input.planMonth,
  });
  if (error) return { error: error.message };
  revalidateBudgets();
  return { id: data };
}

export async function deleteBudgetLine(lineId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_lines").delete().eq("id", lineId).select("id").single();
  return refreshAfter(error);
}

export async function addBudgetMonth(budgetId: string, month: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("budget_add_month", { p_budget_id: budgetId, p_month: month });
  return refreshAfter(error);
}

/** Adds the months of a quarter to a budget, so it can keep growing through the year. */
export async function addBudgetQuarter(budgetId: string, months: string[]): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("budget_add_months", { p_budget_id: budgetId, p_months: months });
  if (error?.code === "23505") return { error: "Another budget with this name already covers those months. Rename this one first." };
  return refreshAfter(error);
}

/** Only an empty budget can be deleted, so nothing that was planned or tracked can vanish. */
export async function deleteEmptyBudget(budgetId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const [{ count: lines, error: linesError }, { count: revenue, error: revenueError }] = await Promise.all([
    supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("budget_id", budgetId),
    supabase.from("budget_revenue").select("id", { count: "exact", head: true }).eq("budget_id", budgetId),
  ]);
  if (linesError || revenueError) return { error: (linesError ?? revenueError)?.message };
  if (lines || revenue) return { error: "Only a budget with no lines or revenue can be deleted." };

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId).select("id").single();
  if (error) return { error: error.message };
  (await cookies()).delete(BUDGET_COOKIE);
  revalidateBudgets();
  return {};
}

const REVENUE_KINDS: BudgetRevenueKind[] = ["grant", "sponsorship", "other"];
const REVENUE_STATUSES: BudgetRevenueStatus[] = ["pending", "approved", "received", "declined"];

export async function addBudgetRevenue(input: {
  budgetId: string;
  kind: BudgetRevenueKind;
  source: string;
  amount: string;
  status: BudgetRevenueStatus;
  expectedOn: string;
}): Promise<BudgetActionResult> {
  const source = input.source.trim();
  const amount = parseAmount(input.amount);
  if (!source) return { error: "Name the source, such as the grant or sponsor." };
  if (amount === null) return { error: AMOUNT_ERROR };
  if (!REVENUE_KINDS.includes(input.kind) || !REVENUE_STATUSES.includes(input.status)) return { error: "Choose a type and status." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expectedOn)) return { error: "Choose a date." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("budget_revenue").insert({
    budget_id: input.budgetId,
    kind: input.kind,
    source,
    amount,
    status: input.status,
    expected_on: input.expectedOn,
    created_by: user?.id ?? null,
  });
  return refreshAfter(error);
}

export async function updateBudgetRevenue(
  revenueId: string,
  change: { source?: string; amount?: string; status?: BudgetRevenueStatus; expectedOn?: string }
): Promise<BudgetActionResult> {
  const source = change.source?.trim();
  const amount = change.amount === undefined ? undefined : parseAmount(change.amount);
  if (source === "") return { error: "Name the source, such as the grant or sponsor." };
  if (amount === null) return { error: AMOUNT_ERROR };
  if (change.status && !REVENUE_STATUSES.includes(change.status)) return { error: "Choose a status." };
  if (change.expectedOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(change.expectedOn)) return { error: "Choose a date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_revenue")
    .update({
      ...(source ? { source } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(change.status ? { status: change.status } : {}),
      ...(change.expectedOn ? { expected_on: change.expectedOn } : {}),
    })
    .eq("id", revenueId)
    .select("id")
    .single();
  return refreshAfter(error);
}

export async function deleteBudgetRevenue(revenueId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_revenue").delete().eq("id", revenueId).select("id").single();
  return refreshAfter(error);
}

/** Changes only what was edited, so two quick edits to an item can't undo each other. */
export async function updateBudgetItem(itemId: string, lineId: string, change: { name?: string; amount?: string }): Promise<BudgetActionResult> {
  const name = change.name?.trim();
  const amount = change.amount === undefined ? undefined : parseAmount(change.amount);
  if (name === "") return { error: "Name this item." };
  if (amount === null) return { error: AMOUNT_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_items")
    .update({ ...(name ? { name } : {}), ...(amount !== undefined ? { amount } : {}) })
    .eq("id", itemId)
    .select("id")
    .single();
  return refreshAfter(error, lineId);
}

export async function saveBudgetItem(input: {
  lineId: string;
  itemId: string | null;
  name: string;
  amount: string;
}): Promise<BudgetActionResult> {
  const name = input.name.trim();
  const amount = parseAmount(input.amount);
  if (!name) return { error: "Name this item." };
  if (amount === null) return { error: AMOUNT_ERROR };

  const supabase = await createClient();
  if (input.itemId) {
    const { error } = await supabase.from("budget_items").update({ name, amount }).eq("id", input.itemId).select("id").single();
    return refreshAfter(error, input.lineId);
  }
  const { data: last } = await supabase
    .from("budget_items")
    .select("sort_order")
    .eq("line_id", input.lineId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("budget_items")
    .insert({ line_id: input.lineId, name, amount, sort_order: (last?.sort_order ?? 0) + 1 });
  return refreshAfter(error, input.lineId);
}

export async function deleteBudgetItem(itemId: string, lineId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", itemId).select("id").single();
  return refreshAfter(error, lineId);
}

export async function updateBudgetExpense(
  expenseId: string,
  input: { lineId: string; itemId: string | null; status: ExpenseStatus; amount: string; incurredOn: string; vendor: string; description: string }
): Promise<BudgetActionResult> {
  const amount = parseAmount(input.amount);
  if (amount === null || amount === 0) return { error: "Enter an amount above zero, in dollars and cents." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.incurredOn)) return { error: "Choose a date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_expenses")
    .update({
      item_id: input.itemId || null,
      status: input.status,
      amount,
      incurred_on: input.incurredOn,
      vendor: input.vendor.trim() || null,
      description: input.description.trim() || null,
    })
    .eq("id", expenseId)
    .select("id")
    .single();
  return refreshAfter(error, input.lineId);
}

export async function renameBudget(budgetId: string, name: string): Promise<BudgetActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name this budget." };
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ name: trimmed }).eq("id", budgetId).select("id").single();
  return refreshAfter(error);
}

export async function addEventRevenue(input: {
  eventId: string;
  source: string;
  amount: string;
  receivedOn: string;
}): Promise<BudgetActionResult> {
  const source = input.source.trim();
  const amount = Number(input.amount);
  if (!source) return { error: "Name the revenue source, such as a sponsor." };
  if (!input.amount.trim() || !Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_revenue").insert({
    event_id: input.eventId,
    source,
    amount,
    received_on: input.receivedOn || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidateBudgets();
  return {};
}

export async function deleteEventRevenue(revenueId: string): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("event_revenue").delete().eq("id", revenueId).select("id").single();
  if (error) return { error: error.message };
  revalidateBudgets();
  return {};
}
