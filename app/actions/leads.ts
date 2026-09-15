"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadStatus } from "@/lib/supabase/types";

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throw error;

  await supabase.from("activities").insert({
    lead_id: leadId,
    type: "status_change",
    body: `Status changed to "${status}"`,
  });

  revalidatePath("/");
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("activities").insert({
    lead_id: leadId,
    type: "note",
    body: trimmed,
  });
  if (error) throw error;

  revalidatePath(`/leads/${leadId}`);
}
