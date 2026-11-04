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
