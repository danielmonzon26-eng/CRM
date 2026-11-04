"use server";

import { revalidatePath } from "next/cache";
import { parseBudgetWorkbook, type ParseResult } from "@/lib/budgets/parse-workbook";
import { createClient } from "@/lib/supabase/server";
import { calgaryDateKey } from "@/lib/events/format";
import type { ExpenseStatus } from "@/lib/supabase/types";

export type BudgetActionResult = { error?: string; id?: string };

const MAX_WORKBOOK_BYTES = 1024 * 1024;

function revalidateBudgets(lineId?: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/reports");
  revalidatePath("/events");
  revalidatePath("/events/[id]", "page");
  if (lineId) revalidatePath(`/budgets/lines/${lineId}`);
}

async function readWorkbook(formData: FormData): Promise<ParseResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: ["Choose an Excel file first."] };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { errors: ["Please upload an .xlsx Excel file."] };
  if (file.size > MAX_WORKBOOK_BYTES) return { errors: ["That file is over the 1 MB limit."] };
  return parseBudgetWorkbook(await file.arrayBuffer(), file.name);
}

/** Reads a workbook and reports what it contains, without saving anything. */
export async function previewBudgetWorkbook(formData: FormData): Promise<ParseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Please sign in again."] };
  return readWorkbook(formData);
}

/** Parses the file again rather than trusting anything the browser sends back. */
export async function importBudgetWorkbook(formData: FormData): Promise<BudgetActionResult> {
  const { budget, errors } = await readWorkbook(formData);
  if (!budget || errors.length > 0) return { error: errors.join(" ") || "That file couldn't be read." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_budget", {
    p_budget: { ...budget, importedOn: calgaryDateKey(new Date()) },
  });
  if (error) {
    if (error.code === "23505") return { error: `"${budget.name}" for ${budget.periodLabel} is already imported.` };
    return { error: error.message };
  }

  revalidateBudgets();
  return { id: data };
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
