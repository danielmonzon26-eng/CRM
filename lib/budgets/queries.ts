import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { addCents, fromCents, sumMoney } from "@/lib/budgets/money";
import type { Database } from "@/lib/supabase/types";
import { personName } from "@/lib/team/names";

type ExpenseRow = Database["public"]["Tables"]["budget_expenses"]["Row"];

const ALERT_AT_PERCENT = 90;

export const BUDGET_COOKIE = "selected_budget";

export type ItemSummary = {
  id: string;
  name: string;
  amount: number;
  notes: string | null;
  committed: number;
  actual: number;
  remaining: number;
};

export type LineSummary = {
  id: string;
  budgetId: string;
  kind: "general" | "event";
  section: string;
  name: string;
  amount: number;
  eventId: string | null;
  eventTitle: string | null;
  ownerName: string | null;
  notes: string | null;
  planMonth: string | null;
  months: Record<string, number>;
  /** Committed and actual spending by month, from each expense's date. */
  spentByMonth: Record<string, { committed: number; actual: number }>;
  committed: number;
  actual: number;
  /** Budget minus committed and actual: what's still free to spend. */
  remaining: number;
  /** Budget minus actual, matching the workbook's Variance column. */
  variance: number;
  percentUsed: number;
};

export type BudgetOverview = {
  id: string;
  name: string;
  periodLabel: string | null;
  sourceFile: string | null;
  months: string[];
  lines: LineSummary[];
  itemsByLine: Record<string, ItemSummary[]>;
  /** The budget's overall total, the money there is to allocate; null until it's set. */
  total: number | null;
  /** The sum of every line's amount: what's been allocated from the total. */
  approved: number;
  committed: number;
  actual: number;
  remaining: number;
  percentUsed: number;
  actualByMonth: Record<string, number>;
};

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : part > 0 ? 100 : 0;
}

function totals(expenses: Pick<ExpenseRow, "status" | "amount">[]) {
  return {
    committed: sumMoney(expenses.filter((e) => e.status === "committed").map((e) => e.amount)),
    actual: sumMoney(expenses.filter((e) => e.status === "actual").map((e) => e.amount)),
  };
}

function summarizeItem(item: Database["public"]["Tables"]["budget_items"]["Row"], expenses: ExpenseRow[]): ItemSummary {
  const { committed, actual } = totals(expenses.filter((e) => e.item_id === item.id));
  return {
    id: item.id,
    name: item.name,
    amount: item.amount,
    notes: item.notes,
    committed,
    actual,
    remaining: fromCents(addCents([item.amount]) - addCents([committed, actual])),
  };
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const date = new Date(`${start}T12:00:00Z`);
  while (date.toISOString().slice(0, 10) <= end) {
    months.push(date.toISOString().slice(0, 10));
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return months;
}

function summarizeLine(
  line: Database["public"]["Tables"]["budget_lines"]["Row"],
  expenses: ExpenseRow[],
  months: Record<string, number>,
  eventTitle: string | null
): LineSummary {
  const { committed, actual } = totals(expenses);
  const spentByMonth: LineSummary["spentByMonth"] = {};
  for (const e of expenses) {
    const month = `${e.incurred_on.slice(0, 7)}-01`;
    const current = spentByMonth[month] ?? { committed: 0, actual: 0 };
    spentByMonth[month] = { ...current, [e.status]: sumMoney([current[e.status], e.amount]) };
  }
  return {
    id: line.id,
    budgetId: line.budget_id,
    kind: line.kind,
    section: line.section,
    name: line.name,
    amount: line.amount,
    eventId: line.event_id,
    eventTitle,
    ownerName: line.owner_name,
    notes: line.notes,
    planMonth: line.plan_month,
    months,
    spentByMonth,
    committed,
    actual,
    remaining: fromCents(addCents([line.amount]) - addCents([committed, actual])),
    variance: fromCents(addCents([line.amount]) - addCents([actual])),
    percentUsed: percentOf(committed + actual, line.amount),
  };
}

export async function getBudgetList(): Promise<{ id: string; name: string; periodLabel: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, name, period_label")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((b) => ({ id: b.id, name: b.name, periodLabel: b.period_label }));
}

/**
 * The budget this person last chose. Without a choice it's the newest budget with lines, so
 * someone creating a new, empty budget doesn't change what everyone else sees.
 */
export async function getSelectedBudgetId(): Promise<string | null> {
  const selected = (await cookies()).get(BUDGET_COOKIE)?.value;
  const budgets = await getBudgetList();
  if (budgets.some((b) => b.id === selected)) return selected ?? null;
  if (budgets.length === 0) return null;

  const supabase = await createClient();
  const { data: lines, error } = await supabase.from("budget_lines").select("budget_id").in("budget_id", budgets.map((b) => b.id));
  if (error) throw error;
  const withLines = new Set(lines.map((l) => l.budget_id));
  return (budgets.find((b) => withLines.has(b.id)) ?? budgets[0]).id;
}

/** One budget with every total, or the selected budget when no id is given. */
export async function getBudgetOverview(budgetId?: string): Promise<BudgetOverview | null> {
  const supabase = await createClient();
  const id = budgetId ?? (await getSelectedBudgetId());
  if (!id) return null;
  const { data: budget, error } = await supabase.from("budgets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!budget) return null;

  const { data: lines, error: linesError } = await supabase
    .from("budget_lines")
    .select("*")
    .eq("budget_id", budget.id)
    .order("sort_order");
  if (linesError) throw linesError;
  const lineIds = lines.map((l) => l.id);

  const [allocations, items, expenses, { data: events, error: eventsError }] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("budget_allocations").select("*").in("line_id", lineIds).range(from, to)),
    fetchAllPages((from, to) => supabase.from("budget_items").select("*").in("line_id", lineIds).order("sort_order").range(from, to)),
    fetchAllPages((from, to) => supabase.from("budget_expenses").select("*").in("line_id", lineIds).range(from, to)),
    supabase.from("events").select("id, title").in("id", lines.map((l) => l.event_id).filter((id): id is string => id !== null)),
  ]);
  if (eventsError) throw eventsError;

  const titleById = new Map(events.map((e) => [e.id, e.title]));
  const period = budget.start_month && budget.end_month ? monthsBetween(budget.start_month, budget.end_month) : [];
  const months = [...new Set([...period, ...allocations.map((a) => a.month)])].sort();

  const summaries = lines.map((line) =>
    summarizeLine(
      line,
      expenses.filter((e) => e.line_id === line.id),
      Object.fromEntries(allocations.filter((a) => a.line_id === line.id).map((a) => [a.month, a.amount])),
      line.event_id ? titleById.get(line.event_id) ?? null : null
    )
  );

  const actualByMonth: Record<string, number> = {};
  for (const e of expenses) {
    if (e.status !== "actual") continue;
    const month = `${e.incurred_on.slice(0, 7)}-01`;
    actualByMonth[month] = sumMoney([actualByMonth[month] ?? 0, e.amount]);
  }

  const approved = sumMoney(summaries.map((l) => l.amount));
  const { committed, actual } = totals(expenses);
  return {
    id: budget.id,
    name: budget.name,
    periodLabel: budget.period_label,
    sourceFile: budget.source_file,
    months,
    lines: summaries,
    total: budget.total_amount === null ? null : Number(budget.total_amount),
    itemsByLine: Object.fromEntries(lines.map((line) => [line.id, items.filter((i) => i.line_id === line.id).map((i) => summarizeItem(i, expenses))])),
    approved,
    committed,
    actual,
    remaining: fromCents(addCents([approved]) - addCents([committed, actual])),
    percentUsed: percentOf(committed + actual, approved),
    actualByMonth,
  };
}

export type BudgetSnapshot = {
  budgetId: string;
  budgetName: string;
  budgets: { id: string; name: string; periodLabel: string | null }[];
  approved: number;
  spent: number;
  percentUsed: number;
  alerts: { lineId: string; name: string; percentUsed: number; over: boolean }[];
};

export async function getBudgetSnapshot(): Promise<BudgetSnapshot | null> {
  const [overview, budgets] = await Promise.all([getBudgetOverview(), getBudgetList()]);
  if (!overview) return null;
  return {
    budgetId: overview.id,
    budgetName: overview.name,
    budgets,
    approved: overview.approved,
    spent: sumMoney([overview.committed, overview.actual]),
    percentUsed: overview.percentUsed,
    alerts: overview.lines
      .filter((l) => l.amount > 0 && l.percentUsed >= ALERT_AT_PERCENT)
      .sort((a, b) => b.percentUsed - a.percentUsed)
      .map((l) => ({ lineId: l.id, name: l.name, percentUsed: l.percentUsed, over: l.remaining < 0 })),
  };
}

export type ExpenseListItem = ExpenseRow & { itemName: string | null };

export type LineDetail = {
  line: LineSummary;
  budgetName: string;
  budgetMonths: string[];
  sections: string[];
  items: ItemSummary[];
  expenses: ExpenseListItem[];
};

async function loadLineDetail(line: Database["public"]["Tables"]["budget_lines"]["Row"]): Promise<LineDetail> {
  const supabase = await createClient();
  const [budgetResult, allocationsResult, itemsResult, expensesResult, eventResult] = await Promise.all([
    supabase.from("budgets").select("name").eq("id", line.budget_id).single(),
    supabase.from("budget_allocations").select("*").eq("line_id", line.id),
    supabase.from("budget_items").select("*").eq("line_id", line.id).order("sort_order"),
    supabase.from("budget_expenses").select("*").eq("line_id", line.id).order("incurred_on", { ascending: false }).order("created_at", { ascending: false }),
    line.event_id ? supabase.from("events").select("title").eq("id", line.event_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const error = budgetResult.error ?? allocationsResult.error ?? itemsResult.error ?? expensesResult.error ?? eventResult.error;
  if (error) throw error;
  const budget = budgetResult.data!;
  const [{ data: siblings, error: siblingsError }] = await Promise.all([
    supabase.from("budget_lines").select("id, section").eq("budget_id", line.budget_id),
  ]);
  if (siblingsError) throw siblingsError;
  const { data: budgetAllocations, error: budgetAllocationsError } = await supabase
    .from("budget_allocations")
    .select("month")
    .in("line_id", siblings.map((l) => l.id));
  if (budgetAllocationsError) throw budgetAllocationsError;
  const allocations = allocationsResult.data!;
  const items = itemsResult.data!;
  const expenses = expensesResult.data!;

  const itemName = new Map(items.map((i) => [i.id, i.name]));
  return {
    line: summarizeLine(line, expenses, Object.fromEntries(allocations.map((a) => [a.month, a.amount])), eventResult.data?.title ?? null),
    budgetName: budget.name,
    budgetMonths: [...new Set(budgetAllocations.map((a) => a.month))].sort(),
    sections: [...new Set(siblings.map((l) => l.section))].sort(),
    items: items.map((item) => summarizeItem(item, expenses)),
    expenses: expenses.map((e) => ({ ...e, itemName: e.item_id ? itemName.get(e.item_id) ?? null : null })),
  };
}

export async function getLineDetail(lineId: string): Promise<LineDetail | null> {
  const supabase = await createClient();
  const { data: line, error } = await supabase.from("budget_lines").select("*").eq("id", lineId).maybeSingle();
  if (error) throw error;
  return line ? loadLineDetail(line) : null;
}

export async function getLineDetailForEvent(eventId: string): Promise<LineDetail | null> {
  const supabase = await createClient();
  const { data: line, error } = await supabase.from("budget_lines").select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return line ? loadLineDetail(line) : null;
}

/** Event lines not yet tied to an event, for the link picker. */
export async function getUnlinkedEventLines(): Promise<{ id: string; name: string; amount: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_lines")
    .select("id, name, amount")
    .eq("kind", "event")
    .is("event_id", null)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getEventOptions(): Promise<{ id: string; title: string; startsAt: string; linked: boolean }[]> {
  const supabase = await createClient();
  const [{ data: events, error }, { data: linked, error: linkedError }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at").is("archived_at", null).neq("status", "cancelled").order("starts_at"),
    supabase.from("budget_lines").select("event_id").not("event_id", "is", null),
  ]);
  if (error) throw error;
  if (linkedError) throw linkedError;
  const linkedIds = new Set(linked.map((l) => l.event_id));
  return events.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, linked: linkedIds.has(e.id) }));
}

export type BudgetChangeRow = Database["public"]["Tables"]["budget_changes"]["Row"] & { lineName: string | null; changedByName: string | null };

const CHANGE_LIMIT = 150;

/** Recent history for a budget or one line, with names resolved. */
export async function getBudgetChanges(filter: { budgetId?: string; lineId?: string }): Promise<BudgetChangeRow[]> {
  const supabase = await createClient();
  let query = supabase.from("budget_changes").select("*").order("changed_at", { ascending: false }).limit(CHANGE_LIMIT);
  if (filter.lineId) query = query.eq("line_id", filter.lineId);
  else if (filter.budgetId) query = query.eq("budget_id", filter.budgetId);
  else return [];

  const { data: changes, error } = await query;
  if (error) throw error;

  const lineIds = [...new Set(changes.map((c) => c.line_id).filter((id): id is string => id !== null))];
  const actorIds = [...new Set(changes.map((c) => c.changed_by).filter((id): id is string => id !== null))];
  const [{ data: lines, error: linesError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from("budget_lines").select("id, name, kind").in("id", lineIds),
    supabase.from("profiles").select("id, full_name, email").in("id", actorIds),
  ]);
  if (linesError) throw linesError;
  if (profilesError) throw profilesError;

  const lineById = new Map(lines.map((l) => [l.id, l]));
  const nameById = new Map(profiles.map((p) => [p.id, personName(p.full_name, p.email)]));

  return changes
    // An event line's months and totals follow its items, so those rows only repeat the item change.
    .filter((c) => !(c.table_name === "budget_allocations" && c.line_id && lineById.get(c.line_id)?.kind === "event"))
    .map((c) => ({
      ...c,
      lineName: c.line_id ? lineById.get(c.line_id)?.name ?? ((c.before_data?.name as string) ?? null) : null,
      changedByName: c.changed_by ? nameById.get(c.changed_by) ?? "Unknown" : null,
    }));
}
