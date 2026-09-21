"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/types";

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throw error;

  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user?.id ?? null,
    type: "status_change",
    body: `Status changed to "${status}"`,
  });

  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user?.id ?? null,
    type: "note",
    body: trimmed,
  });
  if (error) throw error;

  revalidatePath(`/leads/${leadId}`);
}

export async function assignLead(leadId: string, assigneeId: string | null) {
  const supabase = await createClient();

  const { error } = await supabase.from("leads").update({ assigned_to: assigneeId }).eq("id", leadId);
  if (error) throw error;

  const { data: assignee } = assigneeId
    ? await supabase.from("profiles").select("email, full_name").eq("id", assigneeId).maybeSingle()
    : { data: null };

  await supabase.from("activities").insert({
    lead_id: leadId,
    type: "status_change",
    body: assignee
      ? `Assigned to ${assignee.full_name ?? assignee.email ?? "a team member"}`
      : "Unassigned",
  });

  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
}
