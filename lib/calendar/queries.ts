import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { EventFormat, EventStatus } from "@/lib/supabase/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarEvent = {
  id: string;
  slug: string;
  title: string;
  program: string | null;
  format: EventFormat;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  ownerId: string | null;
  capacity: number | null;
  registered: number;
};

export type CalendarTask = {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
  assignedTo: string | null;
  href: string;
};

export async function getCalendarData(): Promise<{ events: CalendarEvent[]; tasks: CalendarTask[] }> {
  const supabase = await createClient();
  const now = Date.now();

  const [events, registrations, tasks] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("events")
        .select("id, slug, title, program, format, status, starts_at, ends_at, venue_name, owner_id, capacity")
        .is("archived_at", null)
        .order("starts_at")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase.from("event_registrations").select("event_id").eq("status", "registered").range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("tasks")
        .select("id, title, due_at, completed_at, assigned_to, lead_id, company_id, event_id")
        .not("due_at", "is", null)
        .gte("due_at", new Date(now - 180 * DAY_MS).toISOString())
        .lte("due_at", new Date(now + 400 * DAY_MS).toISOString())
        .order("due_at")
        .range(from, to)
    ),
  ]);

  const registered = new Map<string, number>();
  for (const r of registrations) registered.set(r.event_id, (registered.get(r.event_id) ?? 0) + 1);

  return {
    events: events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      program: e.program,
      format: e.format,
      status: e.status,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      venueName: e.venue_name,
      ownerId: e.owner_id,
      capacity: e.capacity,
      registered: registered.get(e.id) ?? 0,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.due_at!,
      completed: Boolean(t.completed_at),
      assignedTo: t.assigned_to,
      href: t.lead_id
        ? `/leads/${t.lead_id}`
        : t.company_id
          ? `/companies/${t.company_id}`
          : t.event_id
            ? `/events/${t.event_id}?tab=tasks`
            : "/tasks",
    })),
  };
}
