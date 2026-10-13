"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createContact(input: {
  leadId: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}) {
  const fullName = input.fullName.trim();
  if (!fullName) return;

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    lead_id: input.leadId,
    full_name: fullName,
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    linkedin_url: input.linkedinUrl?.trim() || null,
    source: "manual",
  });
  if (error) throw error;

  await supabase.from("activities").insert({
    lead_id: input.leadId,
    type: "note",
    body: `Added contact: ${fullName}`,
  });

  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/contacts");
}

export async function deleteContact(contactId: string, leadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) throw error;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/contacts");
}

export async function setPrimaryContact(contactId: string, leadId: string) {
  const supabase = await createClient();

  const { error: clearError } = await supabase.from("contacts").update({ is_primary: false }).eq("lead_id", leadId);
  if (clearError) throw clearError;

  const { error } = await supabase.from("contacts").update({ is_primary: true }).eq("id", contactId);
  if (error) throw error;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/contacts");
}
