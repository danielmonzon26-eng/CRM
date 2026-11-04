"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientTypeLabel, isClientType, isLeadProgram, programLabel } from "@/lib/leads/classification";
import { ALL_STATUSES, type LeadFilters, type LeadSort } from "@/lib/leads/filters";
import { searchLeads, type LeadRow } from "@/lib/leads/search";
import type { LeadStatus } from "@/lib/supabase/types";

const MAX_EXPORT_ROWS = 500;
const MAX_BULK_LEADS = 200;

/** Every lead matching the filters, one batch at a time, for a CSV export. */
export async function exportLeadsBatch(
  filters: LeadFilters,
  options: { statuses: string[] | null; sort: LeadSort; desc: boolean; offset: number }
): Promise<{ rows: LeadRow[]; total: number }> {
  return searchLeads(filters, { ...options, limit: MAX_EXPORT_ROWS });
}

function revalidateLeadLists() {
  revalidatePath("/crm");
  revalidatePath("/leads");
}

export async function updateLeadClassification(
  leadId: string,
  change: { clientType?: string | null; programs?: string[] }
): Promise<{ error?: string }> {
  if (change.clientType && !isClientType(change.clientType)) return { error: "That isn't a valid client type." };
  if (change.programs && !change.programs.every(isLeadProgram)) return { error: "That isn't a valid program." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("leads")
    .update({
      ...(change.clientType !== undefined ? { client_type: change.clientType } : {}),
      ...(change.programs ? { programs: change.programs } : {}),
    })
    .eq("id", leadId)
    .select("id")
    .single();
  if (error) return { error: error.message };

  const body =
    change.clientType !== undefined
      ? `Client type set to ${clientTypeLabel(change.clientType) ?? "not set"}`
      : `Programs set to ${change.programs?.length ? change.programs.map(programLabel).join(", ") : "none"}`;
  await supabase.from("activities").insert({ lead_id: leadId, actor_id: user?.id ?? null, type: "note", body });

  revalidateLeadLists();
  revalidatePath(`/leads/${leadId}`);
  return {};
}

/** Adds or removes one program on many leads, keeping each lead's other programs. */
export async function bulkChangeLeadProgram(leadIds: string[], program: string, add: boolean): Promise<{ error?: string; updated?: number }> {
  if (leadIds.length === 0 || leadIds.length > MAX_BULK_LEADS) return { error: `Select between 1 and ${MAX_BULK_LEADS} leads.` };
  if (!isLeadProgram(program)) return { error: "That isn't a valid program." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_change_lead_program", { p_lead_ids: leadIds, p_program: program, p_add: add });
  if (error) return { error: error.message };

  revalidateLeadLists();
  return { updated: data };
}

export async function bulkUpdateLeads(
  leadIds: string[],
  change: { status?: LeadStatus; assigneeId?: string | null; clientType?: string | null }
): Promise<{ error?: string; updated?: number }> {
  if (leadIds.length === 0 || leadIds.length > MAX_BULK_LEADS) return { error: `Select between 1 and ${MAX_BULK_LEADS} leads.` };
  if (change.status && !ALL_STATUSES.includes(change.status)) return { error: "That isn't a valid stage." };
  if (change.clientType && !isClientType(change.clientType)) return { error: "That isn't a valid client type." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const update = {
    ...(change.status ? { status: change.status } : {}),
    ...(change.assigneeId !== undefined ? { assigned_to: change.assigneeId } : {}),
    ...(change.clientType !== undefined ? { client_type: change.clientType } : {}),
  };
  const { data, error } = await supabase.from("leads").update(update).in("id", leadIds).select("id");
  if (error) return { error: error.message };

  if (change.status) {
    await supabase.from("activities").insert(
      data.map((lead) => ({ lead_id: lead.id, actor_id: user?.id ?? null, type: "status_change" as const, body: `Status changed to "${change.status}"` }))
    );
  }

  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath("/leads");
  return { updated: data.length };
}

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
  revalidatePath("/crm");
  revalidatePath("/leads");
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

export async function updateCompanyRevenue(leadId: string, companyId: string, value: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("companies")
    .update({ estimated_annual_revenue: value })
    .eq("id", companyId);
  if (error) throw error;

  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user?.id ?? null,
    type: "note",
    body:
      value !== null
        ? `Estimated annual revenue set to $${value.toLocaleString()}`
        : "Estimated annual revenue cleared",
  });

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
  revalidatePath("/crm");
  revalidatePath(`/leads/${leadId}`);
}
