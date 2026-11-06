import type { BudgetOverview, ItemSummary, LineSummary } from "@/lib/budgets/queries";
import { calgaryDateKey } from "@/lib/events/format";
import { getEventReport, type EventReportRow } from "@/lib/reports/queries";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type RevenueEntry = { id: string; source: string; amount: number; receivedOn: string | null };

export type AnalysisRow = {
  line: LineSummary;
  items: ItemSummary[];
  /** Null until the line is linked to an event, which is where its revenue comes from. */
  report: EventReportRow | null;
  revenue: RevenueEntry[];
};

/** Each event line in a budget beside its event's revenue, using the same figures as Reports. */
export async function getBudgetAnalysis(budget: BudgetOverview): Promise<AnalysisRow[]> {
  const eventLines = budget.lines.filter((l) => l.kind === "event");
  const eventIds = eventLines.map((l) => l.eventId).filter((id): id is string => id !== null);
  if (eventLines.length === 0) return [];

  const supabase = await createClient();
  const [reports, { data: revenue, error }] = await Promise.all([
    eventIds.length ? getEventReport() : Promise.resolve([]),
    supabase.from("event_revenue").select("id, event_id, source, amount, received_on").in("event_id", eventIds).order("received_on", { ascending: false }),
  ]);
  if (error) throw error;

  return eventLines.map((line) => ({
    line,
    items: budget.itemsByLine[line.id] ?? [],
    report: reports.find((r) => r.eventId === line.eventId) ?? null,
    revenue: revenue
      .filter((r) => r.event_id === line.eventId)
      .map((r) => ({ id: r.id, source: r.source, amount: r.amount, receivedOn: r.received_on })),
  }));
}

export type BudgetRevenueEntry = Database["public"]["Tables"]["budget_revenue"]["Row"];

export async function getBudgetRevenue(budgetId: string): Promise<BudgetRevenueEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budget_revenue").select("*").eq("budget_id", budgetId).order("expected_on", { ascending: false });
  if (error) throw error;
  return data;
}

export type WonDeal = { id: string; name: string; companyName: string | null; amount: number; wonOn: string };

/** Proposals won during a budget's months. A deal counts by the date it closed. */
export async function getWonDeals(budget: BudgetOverview): Promise<WonDeal[]> {
  if (budget.months.length === 0) return [];
  const supabase = await createClient();
  const deals = await fetchAllPages((from, to) =>
    supabase.from("deals").select("id, name, amount, company_id, closed_at, expected_close_date").eq("stage", "closed_won").range(from, to)
  );
  const firstDay = budget.months[0];
  const lastMonth = budget.months[budget.months.length - 1];
  const inPeriod = deals
    .map((d) => ({ ...d, wonOn: d.closed_at ? calgaryDateKey(d.closed_at) : d.expected_close_date }))
    .filter((d) => d.wonOn >= firstDay && d.wonOn.slice(0, 7) <= lastMonth.slice(0, 7));

  const { data: companies, error } = await supabase.from("companies").select("id, name").in("id", [...new Set(inPeriod.map((d) => d.company_id))]);
  if (error) throw error;
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  return inPeriod
    .map((d) => ({ id: d.id, name: d.name, companyName: nameById.get(d.company_id) ?? null, amount: d.amount, wonOn: d.wonOn }))
    .sort((a, b) => b.wonOn.localeCompare(a.wonOn));
}
