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
