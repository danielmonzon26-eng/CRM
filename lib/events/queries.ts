import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { AttendanceMode, Database, RegistrationStatus } from "@/lib/supabase/types";

/** Team-facing reads, governed by RLS. The public page uses get_public_event instead. */

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventRegistrationRow = Database["public"]["Tables"]["event_registrations"]["Row"];
export type EventResourceRow = Database["public"]["Tables"]["event_resources"]["Row"];

export type EventListItem = EventRow & { registeredCount: number };

export async function getEvents(): Promise<EventListItem[]> {
  const supabase = await createClient();
  const events = await fetchAllPages((from, to) =>
    supabase.from("events").select("*").order("starts_at", { ascending: false }).range(from, to)
  );
  const registrations = await fetchAllPages((from, to) =>
    supabase.from("event_registrations").select("event_id").eq("status", "registered").range(from, to)
  );

  const counts = new Map<string, number>();
  for (const r of registrations) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  return events.map((e) => ({ ...e, registeredCount: counts.get(e.id) ?? 0 }));
}

export async function getEventsBetween(startIso: string, endIso: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .lte("starts_at", endIso)
    .or(`starts_at.gte.${startIso},ends_at.gte.${startIso}`)
    .order("starts_at");
  if (error) throw error;
  return data;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type EventDocument = EventResourceRow & { downloadUrl: string | null };

export type EventDetail = {
  event: EventRow;
  registrations: EventRegistrationRow[];
  documents: EventDocument[];
  videos: EventResourceRow[];
};

export async function getEventDetail(id: string): Promise<EventDetail | null> {
  const event = await getEvent(id);
  if (!event) return null;

  const supabase = await createClient();
  const [registrations, { data: resources, error }] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    supabase.from("event_resources").select("*").eq("event_id", id).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;

  const documents = await Promise.all(
    resources
      .filter((r) => r.kind === "document")
      .map(async (r) => {
        const { data } = await supabase.storage.from("event-documents").createSignedUrl(r.storage_path!, 3600);
        return { ...r, downloadUrl: data?.signedUrl ?? null };
      })
  );

  return { event, registrations, documents, videos: resources.filter((r) => r.kind === "video") };
}

export type LeadEventRegistration = {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string | null;
  attendeeName: string;
  attendanceMode: AttendanceMode;
  status: RegistrationStatus;
  checkedInAt: string | null;
};

/** The events people from this lead have registered for, soonest-dated first. */
export async function getEventRegistrationsForLead(leadId: string): Promise<LeadEventRegistration[]> {
  const supabase = await createClient();
  const { data: registrations, error } = await supabase
    .from("event_registrations")
    .select("id, event_id, full_name, attendance_mode, status, checked_in_at")
    .eq("lead_id", leadId);
  if (error) throw error;
  if (registrations.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at")
    .in("id", [...new Set(registrations.map((r) => r.event_id))]);
  if (eventsError) throw eventsError;
  const eventById = new Map(events.map((e) => [e.id, e]));

  return registrations
    .flatMap((r) => {
      const event = eventById.get(r.event_id);
      if (!event) return [];
      return [
        {
          id: r.id,
          eventId: r.event_id,
          eventTitle: event.title,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          attendeeName: r.full_name,
          attendanceMode: r.attendance_mode,
          status: r.status,
          checkedInAt: r.checked_in_at,
        },
      ];
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}
