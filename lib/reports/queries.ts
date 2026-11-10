import { addCents, fromCents, sumMoney } from "@/lib/budgets/money";
import { isEventOver } from "@/lib/events/format";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";
import type { EventFormat, EventStatus } from "@/lib/supabase/types";

const OPEN_STAGES_EXCLUDED = new Set(["accepted", "declined"]);
// A contact and registration created together share a transaction timestamp.
const SAME_MOMENT_MS = 1000;

export type EventReportRow = {
  eventId: string;
  title: string;
  program: string | null;
  startsAt: string;
  format: EventFormat;
  status: EventStatus;
  isOver: boolean;
  people: {
    registered: number;
    capacity: number | null;
    waitlisted: number;
    checkedIn: number;
    attendancePercent: number | null;
    newContacts: number;
    companies: number;
  };
  revenue: {
    /** Registered seats times the ticket price. An estimate until payments are connected. */
    ticketsEstimated: number;
    other: number;
    total: number;
    /** Deals created after a registrant signed up. Influenced, not caused, by the event. */
    openPipeline: number;
    closedWon: number;
  };
  costs: {
    budget: number | null;
    budgetLineId: string | null;
    committed: number;
    actual: number;
    remaining: number | null;
  };
  net: number;
  costPerAttendee: number | null;
};

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** People, revenue, and costs for every event that isn't archived, or for one event. */
export async function getEventReport(eventId?: string): Promise<EventReportRow[]> {
  const supabase = await createClient();

  let eventQuery = supabase
    .from("events")
    .select("id, title, program, starts_at, ends_at, format, status, capacity, ticket_type, ticket_price, budget_amount")
    .is("archived_at", null)
    .order("starts_at", { ascending: false });
  if (eventId) eventQuery = eventQuery.eq("id", eventId);
  const { data: events, error } = await eventQuery;
  if (error) throw error;
  if (events.length === 0) return [];
  const ids = events.map((e) => e.id);

  const [registrations, revenue, lines, deals] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("event_registrations")
        .select("event_id, contact_id, lead_id, company_name, status, checked_in_at, created_at")
        .in("event_id", ids)
        .range(from, to)
    ),
    fetchAllPages((from, to) => supabase.from("event_revenue").select("event_id, amount").in("event_id", ids).range(from, to)),
    fetchAllPages((from, to) => supabase.from("budget_lines").select("id, event_id, amount").in("event_id", ids).range(from, to)),
    fetchAllPages((from, to) => supabase.from("deals").select("id, lead_id, stage, amount, created_at").not("lead_id", "is", null).range(from, to)),
  ]);

  const lineIds = lines.map((l) => l.id);
  const contactIds = [...new Set(registrations.map((r) => r.contact_id).filter((id): id is string => id !== null))];
  const [expenses, contacts] = await Promise.all([
    lineIds.length
      ? fetchAllPages((from, to) => supabase.from("budget_expenses").select("line_id, status, amount").in("line_id", lineIds).range(from, to))
      : Promise.resolve([]),
    contactIds.length
      ? fetchAllPages((from, to) => supabase.from("contacts").select("id, source, created_at").in("id", contactIds).range(from, to))
      : Promise.resolve([]),
  ]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  return events.map((event) => {
    const eventRegistrations = registrations.filter((r) => r.event_id === event.id);
    const registered = eventRegistrations.filter((r) => r.status === "registered");
    const checkedIn = registered.filter((r) => r.checked_in_at).length;

    const newContacts = eventRegistrations.filter((r) => {
      const contact = r.contact_id ? contactById.get(r.contact_id) : null;
      return (
        contact?.source === "event_registration" &&
        Math.abs(new Date(contact.created_at).getTime() - new Date(r.created_at).getTime()) <= SAME_MOMENT_MS
      );
    }).length;

    const earliestByLead = new Map<string, number>();
    for (const r of registered) {
      if (!r.lead_id) continue;
      const at = new Date(r.created_at).getTime();
      earliestByLead.set(r.lead_id, Math.min(at, earliestByLead.get(r.lead_id) ?? at));
    }
    const influenced = deals.filter((d) => {
      const since = d.lead_id ? earliestByLead.get(d.lead_id) : undefined;
      return since !== undefined && new Date(d.created_at).getTime() >= since;
    });

    const ticketsEstimated = event.ticket_type === "paid" && event.ticket_price ? fromCents(addCents([event.ticket_price]) * registered.length) : 0;
    const other = sumMoney(revenue.filter((r) => r.event_id === event.id).map((r) => r.amount));
    const total = sumMoney([ticketsEstimated, other]);

    const line = lines.find((l) => l.event_id === event.id) ?? null;
    const lineExpenses = line ? expenses.filter((e) => e.line_id === line.id) : [];
    const committed = sumMoney(lineExpenses.filter((e) => e.status === "committed").map((e) => e.amount));
    const actual = sumMoney(lineExpenses.filter((e) => e.status === "actual").map((e) => e.amount));
    const budget = line?.amount ?? event.budget_amount;

    return {
      eventId: event.id,
      title: event.title,
      program: event.program,
      startsAt: event.starts_at,
      format: event.format,
      status: event.status,
      isOver: isEventOver(event.starts_at, event.ends_at),
      people: {
        registered: registered.length,
        capacity: event.capacity,
        waitlisted: eventRegistrations.filter((r) => r.status === "waitlisted").length,
        checkedIn,
        attendancePercent: percent(checkedIn, registered.length),
        newContacts,
        companies: new Set(registered.map((r) => r.company_name?.trim().toLowerCase()).filter(Boolean)).size,
      },
      revenue: {
        ticketsEstimated,
        other,
        total,
        openPipeline: sumMoney(influenced.filter((d) => !OPEN_STAGES_EXCLUDED.has(d.stage)).map((d) => d.amount)),
        closedWon: sumMoney(influenced.filter((d) => d.stage === "accepted").map((d) => d.amount)),
      },
      costs: {
        budget,
        budgetLineId: line?.id ?? null,
        committed,
        actual,
        remaining: budget === null ? null : fromCents(addCents([budget]) - addCents([committed, actual])),
      },
      net: fromCents(addCents([total]) - addCents([actual])),
      costPerAttendee: checkedIn > 0 && actual > 0 ? fromCents(Math.round(addCents([actual]) / checkedIn)) : null,
    };
  });
}
