import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { addCents, fromCents, sumMoney } from "@/lib/budgets/money";
import type { Database } from "@/lib/supabase/types";

type ExpenseRow = Database["public"]["Tables"]["budget_expenses"]["Row"];
type ItemRow = Database["public"]["Tables"]["budget_items"]["Row"];

const ALERT_AT_PERCENT = 90;

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
  months: Record<string, number>;
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

function summarizeLine(
  line: Database["public"]["Tables"]["budget_lines"]["Row"],
  expenses: ExpenseRow[],
  months: Record<string, number>,
  eventTitle: string | null
): LineSummary {
  const { committed, actual } = totals(expenses);
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
    months,
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

/** One budget with every total, or the newest budget when no id is given. */
export async function getBudgetOverview(budgetId?: string): Promise<BudgetOverview | null> {
  const supabase = await createClient();
  let query = supabase.from("budgets").select("*").order("created_at", { ascending: false }).limit(1);
  if (budgetId) query = query.eq("id", budgetId);
  const { data: budgets, error } = await query;
  if (error) throw error;
  const budget = budgets[0];
  if (!budget) return null;

  const { data: lines, error: linesError } = await supabase
    .from("budget_lines")
    .select("*")
    .eq("budget_id", budget.id)
    .order("sort_order");
  if (linesError) throw linesError;
  const lineIds = lines.map((l) => l.id);

  const [{ data: allocations, error: allocationsError }, expenses, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("budget_allocations").select("*").in("line_id", lineIds),
    fetchAllPages((from, to) => supabase.from("budget_expenses").select("*").in("line_id", lineIds).range(from, to)),
    supabase.from("events").select("id, title").in("id", lines.map((l) => l.event_id).filter((id): id is string => id !== null)),
  ]);
  if (allocationsError) throw allocationsError;
  if (eventsError) throw eventsError;

  const titleById = new Map(events.map((e) => [e.id, e.title]));
  const months = [...new Set(allocations.map((a) => a.month))].sort();

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
    approved,
    committed,
    actual,
    remaining: fromCents(addCents([approved]) - addCents([committed, actual])),
    percentUsed: percentOf(committed + actual, approved),
    actualByMonth,
  };
}

export type BudgetSnapshot = {
  approved: number;
  spent: number;
  percentUsed: number;
  alerts: { lineId: string; name: string; percentUsed: number; over: boolean }[];
};

export async function getBudgetSnapshot(): Promise<BudgetSnapshot | null> {
  const overview = await getBudgetOverview();
  if (!overview) return null;
  return {
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
  items: ItemSummary[];
  expenses: ExpenseListItem[];
};

async function loadLineDetail(line: Database["public"]["Tables"]["budget_lines"]["Row"]): Promise<LineDetail> {
  const supabase = await createClient();
  const [{ data: budget, error: budgetError }, { data: allocations, error: allocationsError }, { data: items, error: itemsError }, { data: expenses, error: expensesError }, eventResult] =
    await Promise.all([
      supabase.from("budgets").select("name").eq("id", line.budget_id).single(),
      supabase.from("budget_allocations").select("*").eq("line_id", line.id),
      supabase.from("budget_items").select("*").eq("line_id", line.id).order("sort_order"),
      supabase.from("budget_expenses").select("*").eq("line_id", line.id).order("incurred_on", { ascending: false }).order("created_at", { ascending: false }),
      line.event_id ? supabase.from("events").select("title").eq("id", line.event_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
  const error = budgetError ?? allocationsError ?? itemsError ?? expensesError ?? eventResult.error;
  if (error) throw error;

  const itemName = new Map((items as ItemRow[]).map((i) => [i.id, i.name]));
  return {
    line: summarizeLine(line, expenses, Object.fromEntries(allocations.map((a) => [a.month, a.amount])), eventResult.data?.title ?? null),
    budgetName: budget.name,
    items: items.map((item) => {
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
    }),
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
