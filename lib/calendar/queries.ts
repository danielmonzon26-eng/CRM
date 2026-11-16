import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { EventFormat, EventStatus } from "@/lib/supabase/types";
import { MARKETING_CATEGORY_LABELS, MARKETING_STATUSES } from "@/lib/budgets/marketing-items";
import { getMarketingItems } from "@/lib/marketing/items-queries";
import { getPosts } from "@/lib/marketing/queries";

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

/** A marketing item's due date, or a social post's scheduled day. */
export type CalendarMarketing = {
  id: string;
  kind: "item" | "post";
  title: string;
  /** "Creative", "Social post", and so on. */
  label: string;
  day: string;
  status: string;
  done: boolean;
  assignedTo: string | null;
  context: string | null;
  href: string;
};

/** A key date someone added to the calendar. */
export type CalendarKeyDate = { id: string; title: string; day: string; notes: string | null; assignedTo: string | null };

export type CalendarData = { events: CalendarEvent[]; tasks: CalendarTask[]; marketing: CalendarMarketing[]; keyDates: CalendarKeyDate[] };

export async function getCalendarData(): Promise<CalendarData> {
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

  // Marketing deadlines and key dates add to the calendar; if they can't load, events and tasks still show.
  const [items, posts, keyDates] = await Promise.all([
    getMarketingItems().catch((e) => (console.error("Calendar marketing items failed:", e), [])),
    getPosts().catch((e) => (console.error("Calendar posts failed:", e), [])),
    supabase
      .from("calendar_key_dates")
      .select("id, title, on_date, notes, assigned_to")
      .order("on_date")
      .then(({ data, error }) => (error ? (console.error("Calendar key dates failed:", error), []) : (data ?? []))),
  ]);
  const statusLabel = new Map<string, string>(MARKETING_STATUSES);
  const marketing: CalendarMarketing[] = [
    ...items
      .filter((i) => i.due)
      .map((i) => ({
        id: i.id,
        kind: "item" as const,
        title: i.name,
        label: MARKETING_CATEGORY_LABELS[i.type] ?? "Marketing",
        day: i.due!,
        status: statusLabel.get(i.status) ?? i.status,
        done: i.status === "done",
        assignedTo: i.assigneeId,
        context: i.event?.title ?? i.sponsor?.name ?? "Catapult",
        href: i.event ? `/events/${i.event.id}?tab=budget` : `/marketing/${i.stream}`,
      })),
    ...posts
      .filter((p) => p.dayKey)
      .map((p) => ({
        id: p.id,
        kind: "post" as const,
        title: p.title,
        label: "Social post",
        day: p.dayKey!,
        status: p.status === "approved" ? "Approved" : p.status === "waiting_approval" ? "Waiting approval" : "Requested",
        done: p.status === "approved" && p.isPast,
        assignedTo: p.createdBy,
        context: p.event?.title ?? null,
        href: `/marketing/posts/${p.id}`,
      })),
  ];

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
    marketing,
    keyDates: keyDates.map((k) => ({ id: k.id, title: k.title, day: k.on_date, notes: k.notes, assignedTo: k.assigned_to })),
  };
}
