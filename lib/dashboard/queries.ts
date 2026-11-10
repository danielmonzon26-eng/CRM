import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { getBudgetSnapshot, type BudgetSnapshot } from "@/lib/budgets/queries";
import { getPipelineForecast } from "@/lib/deals/queries";
import { isEventOver } from "@/lib/events/format";
import { registrationProgress, type RegistrationProgress } from "@/lib/events/progress";
import type { ActivityType, EventFormat, EventStatus, TaskType } from "@/lib/supabase/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_LEAD_STATUSES = ["engagement", "in_contact", "discovery_meeting", "pitch_meeting"] as const;

export type DashboardEvent = {
  id: string;
  title: string;
  program: string | null;
  startsAt: string;
  endsAt: string | null;
  format: EventFormat;
  venueName: string | null;
  status: EventStatus;
  capacity: number | null;
  registered: number;
  progress: RegistrationProgress;
};

export type DashboardTask = {
  id: string;
  title: string;
  taskType: TaskType;
  dueAt: string;
  href: string;
};

export type DashboardActivity = {
  id: string;
  type: ActivityType;
  body: string | null;
  createdAt: string;
  leadId: string;
  companyName: string;
};

export type DashboardLead = {
  id: string;
  companyName: string;
  score: number;
  status: string;
};

export type DashboardRegistration = {
  id: string;
  fullName: string;
  companyName: string | null;
  eventId: string;
  eventTitle: string;
  createdAt: string;
};

export type ProgramRow = {
  name: string;
  events: number;
  registrations: number;
  /** Null until a past event in this program has registrations. */
  attendancePercent: number | null;
};

export type DashboardData = {
  kpis: {
    upcomingEvents: number;
    eventsNext30Days: number;
    registrations: number;
    registrationsThisWeek: number;
    attendancePercent: number | null;
    contacts: number;
    openDeals: number;
    openDealValue: number;
    overdueTasks: number;
  };
  upcomingEvents: DashboardEvent[];
  tasksDue: DashboardTask[];
  activity: DashboardActivity[];
  leadsNeedingAttention: DashboardLead[];
  unassignedLeadCount: number;
  registrations: DashboardRegistration[];
  programs: ProgramRow[];
  budget: BudgetSnapshot | null;
};

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Everything on the Operations dashboard, read live under the signed-in user's RLS. */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const [
    events,
    allRegistrations,
    forecast,
    budget,
    { count: contacts, error: contactsError },
    { count: overdueTasks, error: overdueError },
    { data: taskRows, error: tasksError },
    { data: activityRows, error: activitiesError },
    { data: leadRows, error: leadsError },
    { count: unassignedLeadCount, error: unassignedError },
  ] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("events")
        .select("id, title, program, starts_at, ends_at, format, venue_name, status, capacity, target_attendees, created_at")
        .neq("status", "cancelled")
        .is("archived_at", null)
        .order("starts_at")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("event_registrations")
        .select("id, event_id, full_name, company_name, checked_in_at, created_at")
        .eq("status", "registered")
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    getPipelineForecast(),
    getBudgetSnapshot(),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null).lt("due_at", nowIso),
    supabase
      .from("tasks")
      .select("id, title, task_type, due_at, lead_id, company_id, event_id")
      .is("completed_at", null)
      .not("due_at", "is", null)
      .lte("due_at", new Date(now + 7 * DAY_MS).toISOString())
      .order("due_at")
      .limit(8),
    supabase
      .from("activities")
      .select("id, type, body, created_at, lead_id")
      .not("type", "in", "(sync_matched,enrichment_run)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("leads")
      .select("id, company_id, score, status")
      .in("status", [...ACTIVE_LEAD_STATUSES])
      .eq("engagement", "engaged")
      .is("assigned_to", null)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_LEAD_STATUSES])
      .eq("engagement", "engaged")
      .is("assigned_to", null),
  ]);
  const queryError = contactsError ?? overdueError ?? tasksError ?? activitiesError ?? leadsError ?? unassignedError;
  if (queryError) throw queryError;
  const tasks = taskRows ?? [];
  const activities = activityRows ?? [];
  const leads = leadRows ?? [];

  // Company names for the activity feed, which only carries lead ids.
  const activityLeadIds = [...new Set(activities.map((a) => a.lead_id))];
  const { data: activityLeads, error: activityLeadsError } = activityLeadIds.length
    ? await supabase.from("leads").select("id, company_id").in("id", activityLeadIds)
    : { data: [], error: null };
  if (activityLeadsError) throw activityLeadsError;
  const companyIdByLead = new Map(activityLeads.map((l) => [l.id, l.company_id]));

  const companyIds = [...new Set([...leads.map((l) => l.company_id), ...activityLeads.map((l) => l.company_id)])];
  const { data: companies, error: companiesError } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [], error: null };
  if (companiesError) throw companiesError;
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const eventById = new Map(events.map((e) => [e.id, e]));
  const registeredByEvent = new Map<string, number>();
  for (const r of allRegistrations) registeredByEvent.set(r.event_id, (registeredByEvent.get(r.event_id) ?? 0) + 1);

  const upcoming = events.filter((e) => !isEventOver(e.starts_at, e.ends_at));
  const thirtyDays = now + 30 * DAY_MS;

  const pastEventIds = new Set(events.filter((e) => isEventOver(e.starts_at, e.ends_at)).map((e) => e.id));
  const pastRegistrations = allRegistrations.filter((r) => pastEventIds.has(r.event_id));

  const programs = new Map<string, { events: number; registrations: number; pastRegistered: number; attended: number }>();
  const program = (name: string | null | undefined) => {
    const key = name?.trim() || "Other events";
    const row = programs.get(key) ?? { events: 0, registrations: 0, pastRegistered: 0, attended: 0 };
    programs.set(key, row);
    return row;
  };
  for (const e of events) program(e.program).events++;
  for (const r of allRegistrations) {
    const row = program(eventById.get(r.event_id)?.program);
    row.registrations++;
    if (pastEventIds.has(r.event_id)) {
      row.pastRegistered++;
      if (r.checked_in_at) row.attended++;
    }
  }

  return {
    budget,
    kpis: {
      upcomingEvents: upcoming.length,
      eventsNext30Days: upcoming.filter((e) => new Date(e.starts_at).getTime() <= thirtyDays).length,
      registrations: allRegistrations.length,
      registrationsThisWeek: allRegistrations.filter((r) => new Date(r.created_at).getTime() >= now - 7 * DAY_MS).length,
      attendancePercent: percent(pastRegistrations.filter((r) => r.checked_in_at).length, pastRegistrations.length),
      contacts: contacts ?? 0,
      openDeals: forecast.openCount,
      openDealValue: forecast.openValue,
      overdueTasks: overdueTasks ?? 0,
    },
    upcomingEvents: upcoming.slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title,
      program: e.program,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      format: e.format,
      venueName: e.venue_name,
      status: e.status,
      capacity: e.capacity,
      registered: registeredByEvent.get(e.id) ?? 0,
      progress: registrationProgress({
        registered: registeredByEvent.get(e.id) ?? 0,
        target: e.target_attendees,
        capacity: e.capacity,
        createdAt: e.created_at,
        startsAt: e.starts_at,
      }),
    })),
    tasksDue: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      taskType: t.task_type,
      dueAt: t.due_at!,
      href: t.lead_id
        ? `/leads/${t.lead_id}`
        : t.company_id
          ? `/companies/${t.company_id}`
          : t.event_id
            ? `/events/${t.event_id}?tab=tasks`
            : "/tasks",
    })),
    activity: activities.map((a) => ({
      id: a.id,
      type: a.type,
      body: a.body,
      createdAt: a.created_at,
      leadId: a.lead_id,
      companyName: companyName.get(companyIdByLead.get(a.lead_id) ?? "") ?? "Unknown company",
    })),
    leadsNeedingAttention: leads.map((l) => ({
      id: l.id,
      companyName: companyName.get(l.company_id) ?? "Unknown company",
      score: l.score,
      status: l.status,
    })),
    unassignedLeadCount: unassignedLeadCount ?? 0,
    registrations: allRegistrations.slice(0, 6).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      companyName: r.company_name,
      eventId: r.event_id,
      eventTitle: eventById.get(r.event_id)?.title ?? "Event",
      createdAt: r.created_at,
    })),
    programs: [...programs.entries()]
      .map(([name, row]) => ({
        name,
        events: row.events,
        registrations: row.registrations,
        attendancePercent: percent(row.attended, row.pastRegistered),
      }))
      .sort((a, b) => b.registrations - a.registrations || a.name.localeCompare(b.name)),
  };
}
