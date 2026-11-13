"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type Program = { id: string; name: string };

export async function listEventPrograms(): Promise<Program[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_programs").select("id, name").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function addEventProgram(name: string): Promise<{ error?: string; program?: Program }> {
  if (!(await getCurrentUser())) return { error: "Sign in first." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "Type the program's name." };
  if (clean.length > 80) return { error: "Keep the name under 80 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_programs").insert({ name: clean, sort_order: 50 }).select("id, name").single();
  if (error) return { error: error.code === "23505" ? `${clean} is already on the list.` : "That didn't save. Please try again." };
  revalidatePath("/events", "layout");
  return { program: data };
}

/** Takes a program off the dropdown; events already using it keep it. */
export async function removeEventProgram(id: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_programs").delete().eq("id", id);
  if (error) return { error: "That wasn't removed. Please try again." };
  revalidatePath("/events", "layout");
  return {};
}
