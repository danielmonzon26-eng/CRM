"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fromDateTimeInput } from "@/lib/events/format";
import type { EventFormat, EventStatus, EventTicketType } from "@/lib/supabase/types";

export type EventInput = {
  title: string;
  eventType: string;
  description: string;
  imageUrl: string;
  format: EventFormat;
  venueName: string;
  venueAddress: string;
  onlineUrl: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  ticketType: EventTicketType;
  ticketPrice: string;
};

export type ActionResult = { error?: string; id?: string };

function isWebUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function revalidateEvent(id: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/calendar");
}

function parseEventInput(input: EventInput) {
  const title = input.title.trim();
  if (!title) return { error: "Add a title." };
  if (!input.startsAt) return { error: "Add a start date and time." };

  const inPerson = input.format !== "online";
  const online = input.format !== "in_person";
  if (inPerson && !input.venueName.trim()) return { error: "Add a venue for an in-person event." };
  if (online && !isWebUrl(input.onlineUrl.trim())) {
    return { error: "Add a valid join link, starting with https://, for an online event." };
  }

  const imageUrl = input.imageUrl.trim();
  if (imageUrl && !isWebUrl(imageUrl)) return { error: "The image link must start with https://." };

  const startsAt = fromDateTimeInput(input.startsAt);
  const endsAt = input.endsAt ? fromDateTimeInput(input.endsAt) : null;
  if (endsAt && endsAt < startsAt) return { error: "The end time must be after the start time." };

  const capacity = input.capacity.trim() ? Number(input.capacity) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "Capacity must be a whole number of at least 1, or left blank." };
  }

  const ticketPrice = input.ticketType === "paid" ? Number(input.ticketPrice) : null;
  if (ticketPrice !== null && (!input.ticketPrice.trim() || !Number.isFinite(ticketPrice) || ticketPrice < 0)) {
    return { error: "Add a ticket price for a paid event." };
  }

  return {
    values: {
      title,
      event_type: input.eventType.trim() || null,
      description: input.description.trim() || null,
      image_url: imageUrl || null,
      format: input.format,
      venue_name: inPerson ? input.venueName.trim() : null,
      venue_address: inPerson ? input.venueAddress.trim() || null : null,
      online_url: online ? input.onlineUrl.trim() : null,
      starts_at: startsAt,
      ends_at: endsAt,
      capacity,
      ticket_type: input.ticketType,
      ticket_price: ticketPrice,
    },
  };
}

export async function createEvent(input: EventInput): Promise<ActionResult> {
  const parsed = parseEventInput(input);
  if (!parsed.values) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = `${slugify(parsed.values.title) || "event"}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.values, slug, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidateEvent(data.id);
  return { id: data.id };
}

export async function updateEvent(id: string, input: EventInput): Promise<ActionResult> {
  const parsed = parseEventInput(input);
  if (!parsed.values) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("events").update(parsed.values).eq("id", id);
  if (error) return { error: error.message };

  revalidateEvent(id);
  return { id };
}

export async function setEventStatus(id: string, status: EventStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
  revalidateEvent(id);
}

export async function setRegistrationCheckedIn(registrationId: string, eventId: string, checkedIn: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq("id", registrationId);
  if (error) throw error;
  revalidatePath(`/events/${eventId}`);
}

export async function setRegistrationCancelled(registrationId: string, eventId: string, cancelled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .update({ status: cancelled ? "cancelled" : "registered", checked_in_at: null })
    .eq("id", registrationId);
  if (error) throw error;
  revalidateEvent(eventId);
}

export async function addEventVideo(eventId: string, title: string, url: string): Promise<ActionResult> {
  const trimmedUrl = url.trim();
  if (!isWebUrl(trimmedUrl)) return { error: "Add a valid video link, starting with https://." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_resources").insert({
    event_id: eventId,
    kind: "video",
    title: title.trim() || "Event recording",
    url: trimmedUrl,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return {};
}

/** Records a file the browser has already uploaded to the event-documents bucket. */
export async function addEventDocument(eventId: string, title: string, storagePath: string): Promise<ActionResult> {
  if (!storagePath.startsWith(`${eventId}/`)) return { error: "That upload doesn't belong to this event." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_resources").insert({
    event_id: eventId,
    kind: "document",
    title,
    storage_path: storagePath,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return {};
}

export async function removeEventResource(resourceId: string, eventId: string) {
  const supabase = await createClient();
  const { data: resource, error } = await supabase
    .from("event_resources")
    .select("storage_path")
    .eq("id", resourceId)
    .single();
  if (error) throw error;

  if (resource.storage_path) {
    const { error: storageError } = await supabase.storage.from("event-documents").remove([resource.storage_path]);
    if (storageError) throw storageError;
  }
  const { error: deleteError } = await supabase.from("event_resources").delete().eq("id", resourceId);
  if (deleteError) throw deleteError;

  revalidatePath(`/events/${eventId}`);
}
