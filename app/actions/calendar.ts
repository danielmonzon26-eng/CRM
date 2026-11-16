"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function isValidInstant(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function revalidateCalendar() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/events");
}

export async function rescheduleEvent(id: string, startsAt: string, endsAt: string | null): Promise<{ error?: string }> {
  if (!isValidInstant(startsAt) || (endsAt && !isValidInstant(endsAt))) return { error: "That isn't a valid time." };

  const supabase = await createClient();
  // Selecting the row back means a change that saved nothing is reported, not hidden.
  const { error } = await supabase
    .from("events")
    .update({ starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidateCalendar();
  revalidatePath(`/events/${id}`);
  return {};
}

export async function rescheduleTask(id: string, dueAt: string): Promise<{ error?: string }> {
  if (!isValidInstant(dueAt)) return { error: "That isn't a valid date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ due_at: new Date(dueAt).toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidateCalendar();
  revalidatePath("/tasks");
  return {};
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Adds a key date to the calendar: a title, a day, and optionally a person and notes. */
export async function createKeyDate(input: { day: string; title: string; assignedTo: string | null; notes: string }): Promise<{ error?: string; id?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Give it a title." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (!DAY.test(input.day)) return { error: "Pick a day." };
  if (input.assignedTo && !UUID.test(input.assignedTo)) return { error: "Choose someone from the list." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  const { data, error } = await supabase
    .from("calendar_key_dates")
    .insert({ title, on_date: input.day, assigned_to: input.assignedTo || null, notes: input.notes.trim() || null, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: "That wasn't saved. Please try again." };
  revalidateCalendar();
  return { id: data.id };
}

export async function moveKeyDate(id: string, day: string): Promise<{ error?: string }> {
  if (!UUID.test(id) || !DAY.test(day)) return { error: "That isn't a valid day." };
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_key_dates").update({ on_date: day }).eq("id", id).select("id").single();
  if (error) return { error: "That wasn't moved. Please try again." };
  revalidateCalendar();
  return {};
}

export async function deleteKeyDate(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "That key date wasn't found." };
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_key_dates").delete().eq("id", id);
  if (error) return { error: "That wasn't removed. Please try again." };
  revalidateCalendar();
  return {};
}
