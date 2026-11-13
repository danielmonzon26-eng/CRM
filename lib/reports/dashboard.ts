import { getBudgetSnapshot, type BudgetSnapshot } from "@/lib/budgets/queries";
import { getPipelineForecast, type PipelineForecast } from "@/lib/deals/queries";
import { calgaryDateKey, EVENT_TIME_ZONE } from "@/lib/events/format";
import { getEvents } from "@/lib/events/queries";
import type { RegistrationProgress } from "@/lib/events/progress";
import { ALL_STATUSES, type LeadFilters } from "@/lib/leads/filters";
import { getStageSummaries, type StageSummary } from "@/lib/leads/search";
import { createClient } from "@/lib/supabase/server";
import type { EventReportRow } from "@/lib/reports/queries";

const DAY_MS = 86_400_000;
const eventDay = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE });

/** Every lead, whatever its engagement, in no saved view: the whole funnel. */
const ALL_LEADS: LeadFilters = {
  q: "",
  industry: "",
  community: "",
  score: "",
  contact: "",
  event: "",
  status: "",
  clientType: "",
  program: "",
  proposal: "",
  engagement: "all",
  view: "all",
};

export type ReportsDashboard = {
  stages: StageSummary[];
  activeLeads: number;
  clients: number;
  pipeline: PipelineForecast & { winRate: number | null };
  upcoming: { id: string; title: string; whenLabel: string; progress: RegistrationProgress }[];
  upcomingTotals: { registered: number; target: number; eventsWithTarget: number };
  recent: { id: string; title: string; whenLabel: string; registered: number; checkedIn: number; attendancePercent: number | null }[];
  budget: BudgetSnapshot | null;
  marketing: { approvedThisMonth: number; waiting: number; monthLabel: string };
};

/** One page of headline numbers across leads, proposals, events, budget and marketing. */
export async function getReportsDashboard(report: EventReportRow[], now = new Date()): Promise<ReportsDashboard> {
  const supabase = await createClient();
  const month = calgaryDateKey(now).slice(0, 7);
  const monthStart = new Date(`${month}-01T06:00:00Z`).toISOString();
  const [y, m] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 1, 6)).toISOString();

  const [stages, forecast, events, budget, approved, waiting] = await Promise.all([
    getStageSummaries(ALL_LEADS),
    getPipelineForecast(),
    getEvents(),
    // The budget panel is a bonus; the rest of the page doesn't depend on it.
    getBudgetSnapshot().catch((e) => {
      console.error("Budget snapshot for reports failed:", e);
      return null;
    }),
    supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "approved").gte("scheduled_at", monthStart).lt("scheduled_at", monthEnd),
    supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "waiting_approval"),
  ]);
  if (approved.error) throw approved.error;
  if (waiting.error) throw waiting.error;

  const t = now.getTime();
  const upcomingEvents = events
    .filter((e) => e.status === "published" && !e.archived_at && new Date(e.starts_at).getTime() >= t && new Date(e.starts_at).getTime() < t + 90 * DAY_MS)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const decided = forecast.closedWonCount + forecast.closedLostCount;

  return {
    stages: ALL_STATUSES.map((s) => stages.find((x) => x.status === s) ?? { status: s, count: 0, openValue: 0 }),
    activeLeads: stages.filter((s) => s.status !== "client").reduce((sum, s) => sum + s.count, 0),
    clients: stages.find((s) => s.status === "client")?.count ?? 0,
    pipeline: { ...forecast, winRate: decided ? Math.round((forecast.closedWonCount / decided) * 100) : null },
    upcoming: upcomingEvents.slice(0, 8).map((e) => ({ id: e.id, title: e.title, whenLabel: eventDay.format(new Date(e.starts_at)), progress: e.progress })),
    upcomingTotals: {
      registered: upcomingEvents.reduce((sum, e) => sum + e.registeredCount, 0),
      target: upcomingEvents.reduce((sum, e) => sum + (e.target_attendees ?? 0), 0),
      eventsWithTarget: upcomingEvents.filter((e) => e.target_attendees).length,
    },
    recent: report
      .filter((r) => r.isOver && r.status !== "cancelled" && new Date(r.startsAt).getTime() > t - 120 * DAY_MS)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 6)
      .map((r) => ({
        id: r.eventId,
        title: r.title,
        whenLabel: eventDay.format(new Date(r.startsAt)),
        registered: r.people.registered,
        checkedIn: r.people.checkedIn,
        attendancePercent: r.people.attendancePercent,
      })),
    budget,
    marketing: {
      approvedThisMonth: approved.count ?? 0,
      waiting: waiting.count ?? 0,
      monthLabel: new Intl.DateTimeFormat("en-CA", { month: "long", timeZone: EVENT_TIME_ZONE }).format(now),
    },
  };
}
