"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fromDateTimeInput, toDateTimeInput } from "@/lib/events/format";
import { getMissingForPublish, isWebUrl, type EventInput } from "@/lib/events/validation";
import type { EventRow } from "@/lib/events/queries";
import type { EventStatus } from "@/lib/supabase/types";

export type ActionResult = { error?: string; id?: string; slug?: string };

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function newSlug(title: string): string {
  return `${slugify(title) || "event"}-${crypto.randomUUID().slice(0, 6)}`;
}

function revalidateEvent(id: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/calendar");
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

/**
 * Drafts need only a name and a start time, so the flow can autosave early. A published
 * event must stay complete, so `requireComplete` also applies the publish checks.
 */
function parseEventInput(input: EventInput, requireComplete: boolean) {
  const title = input.title.trim();
  if (!title) return { error: "Add an event name." };
  if (!input.startsAt) return { error: "Add a start date and time." };

  if (requireComplete) {
    const missing = getMissingForPublish(input);
    if (missing.length > 0) return { error: `Still needed: ${missing.join(", ")}.` };
  }

  const inPerson = input.format !== "online";
  const online = input.format !== "in_person";
  const onlineUrl = input.onlineUrl.trim();
  if (online && onlineUrl && !isWebUrl(onlineUrl)) return { error: "The join link must start with https://." };

  const imageUrl = input.imageUrl.trim();
  if (imageUrl && !isWebUrl(imageUrl)) return { error: "The image link must start with https://." };

  const startsAt = fromDateTimeInput(input.startsAt);
  const endsAt = input.endsAt ? fromDateTimeInput(input.endsAt) : null;
  if (endsAt && endsAt < startsAt) return { error: "The end time must be after the start time." };

  const opensAt = input.registrationOpensAt ? fromDateTimeInput(input.registrationOpensAt) : null;
  const closesAt = input.registrationClosesAt ? fromDateTimeInput(input.registrationClosesAt) : null;
  if (opensAt && closesAt && closesAt < opensAt) return { error: "Registration must close after it opens." };

  const capacity = parseNumber(input.capacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "Max attendees must be a whole number of at least 1, or left blank." };
  }
  const targetAttendees = parseNumber(input.targetAttendees ?? "");
  if (targetAttendees !== null && (!Number.isInteger(targetAttendees) || targetAttendees < 1)) {
    return { error: "The target must be a whole number of at least 1, or left blank." };
  }
  if (targetAttendees !== null && capacity !== null && targetAttendees > capacity) {
    return { error: "The target can't be more than the max attendees." };
  }

  const ticketPrice = input.ticketType === "paid" ? parseNumber(input.ticketPrice) : null;
  if (ticketPrice !== null && (!Number.isFinite(ticketPrice) || ticketPrice < 0)) {
    return { error: "The ticket price must be a positive number." };
  }

  const budgetAmount = parseNumber(input.budgetAmount);
  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    return { error: "The budget must be a positive number." };
  }

  return {
    values: {
      title,
      program: input.program.trim() || null,
      event_type: input.eventType.trim() || null,
      description: input.description.trim() || null,
      image_url: imageUrl || null,
      owner_id: input.ownerId || null,
      format: input.format,
      venue_name: inPerson ? input.venueName.trim() || null : null,
      venue_address: inPerson ? input.venueAddress.trim() || null : null,
      online_url: online ? onlineUrl || null : null,
      starts_at: startsAt,
      ends_at: endsAt,
      agenda: input.agenda.filter((a) => a.title.trim()),
      speakers: input.speakers.filter((s) => s.name.trim()),
      capacity,
      target_attendees: targetAttendees,
      ticket_type: input.ticketType,
      ticket_price: ticketPrice,
      collect_company: input.collectCompany,
      collect_phone: input.collectPhone,
      waitlist_enabled: input.waitlistEnabled,
      registration_opens_at: opensAt,
      registration_closes_at: closesAt,
      confirmation_message: input.confirmationMessage.trim() || null,
      budget_amount: budgetAmount,
      funding_source: input.fundingSource.trim() || null,
      budget_notes: input.budgetNotes.trim() || null,
    },
  };
}

function rowToInput(row: EventRow): EventInput {
  return {
    title: row.title,
    program: row.program ?? "",
    eventType: row.event_type ?? "",
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    ownerId: row.owner_id ?? "",
    startsAt: toDateTimeInput(row.starts_at),
    endsAt: toDateTimeInput(row.ends_at),
    format: row.format,
    venueName: row.venue_name ?? "",
    venueAddress: row.venue_address ?? "",
    onlineUrl: row.online_url ?? "",
    agenda: row.agenda,
    speakers: row.speakers,
    ticketType: row.ticket_type,
    ticketPrice: row.ticket_price?.toString() ?? "",
    capacity: row.capacity?.toString() ?? "",
    targetAttendees: row.target_attendees?.toString() ?? "",
    collectCompany: row.collect_company,
    collectPhone: row.collect_phone,
    waitlistEnabled: row.waitlist_enabled,
    registrationOpensAt: toDateTimeInput(row.registration_opens_at),
    registrationClosesAt: toDateTimeInput(row.registration_closes_at),
    confirmationMessage: row.confirmation_message ?? "",
    budgetAmount: row.budget_amount?.toString() ?? "",
    fundingSource: row.funding_source ?? "",
    budgetNotes: row.budget_notes ?? "",
  };
}

/** Creates the event when `id` is null, otherwise updates it. New events start as drafts. */
export async function saveEvent(id: string | null, input: EventInput): Promise<ActionResult> {
  const supabase = await createClient();

  if (id) {
    const { data: current, error: currentError } = await supabase.from("events").select("status").eq("id", id).single();
    if (currentError) return { error: currentError.message };

    const parsed = parseEventInput(input, current.status === "published");
    if (!parsed.values) return { error: parsed.error };

    // A linked budget line owns the event's budget total (its items add up to it), so a
    // save from the wizard never overwrites it with an older number.
    const { data: linkedLine } = await supabase.from("budget_lines").select("id").eq("event_id", id).maybeSingle();
    const { budget_amount: _budgetAmount, ...unlinkedValues } = parsed.values;
    const values = linkedLine ? unlinkedValues : parsed.values;

    const { error } = await supabase.from("events").update(values).eq("id", id);
    if (error) return { error: error.message };

    revalidateEvent(id);
    return { id };
  }

  const parsed = parseEventInput(input, false);
  if (!parsed.values) return { error: parsed.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.values, slug: newSlug(parsed.values.title), created_by: user?.id ?? null })
    .select("id, slug")
    .single();
  if (error) return { error: error.message };

  revalidateEvent(data.id);
  return { id: data.id, slug: data.slug };
}

export async function setEventStatus(id: string, status: EventStatus): Promise<ActionResult> {
  const supabase = await createClient();

  if (status === "published") {
    const { data: event, error } = await supabase.from("events").select("*").eq("id", id).single();
    if (error) return { error: error.message };
    const missing = getMissingForPublish(rowToInput(event));
    if (missing.length > 0) return { error: `Still needed before publishing: ${missing.join(", ")}.` };
  }

  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidateEvent(id);
  return { id };
}

/** Copies the plan into a new draft. Registrations, materials, and videos stay with the original. */
export async function duplicateEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event, error } = await supabase.from("events").select("*").eq("id", id).single();
  if (error) return { error: error.message };

  const { id: _id, slug: _slug, status: _status, archived_at: _archived, created_at: _c, updated_at: _u, ...plan } = event;
  const title = `${event.title} (copy)`;
  const { data, error: insertError } = await supabase
    .from("events")
    .insert({ ...plan, title, slug: newSlug(title), created_by: user?.id ?? null })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  revalidateEvent(data.id);
  return { id: data.id };
}

export async function setEventsArchived(ids: string[], archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/calendar");
  return {};
}

export async function saveEventTemplate(name: string, input: EventInput): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name the template." };

  // Dates are specific to one event, so they're left out of a reusable plan.
  const { startsAt: _s, endsAt: _e, registrationOpensAt: _o, registrationClosesAt: _c, ...data } = input;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("event_templates")
    .insert({ name: trimmed, data, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/events/new");
  return { id: created.id };
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

// For payments the team takes outside Stripe (cash, cheque, invoice). Stripe payments are
// recorded by the webhook in app/api/stripe/webhook/route.ts.
export async function setRegistrationPaid(registrationId: string, eventId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .update(paid ? { payment_status: "paid", paid_at: new Date().toISOString() } : { payment_status: "unpaid", paid_at: null })
    .eq("id", registrationId)
    .in("payment_status", paid ? ["unpaid"] : ["paid"])
    .is("stripe_payment_intent_id", null);
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
