"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ALL_STATUSES, type LeadFilters, type LeadSort } from "@/lib/leads/filters";
import { searchLeads, type LeadRow } from "@/lib/leads/search";
import type { LeadStatus } from "@/lib/supabase/types";

const MAX_EXPORT_ROWS = 500;
const MAX_BULK_LEADS = 200;

/** The next batch for one board column. */
export async function loadLeadsPage(
  filters: LeadFilters,
  options: { status: LeadStatus; sort: LeadSort; desc: boolean; offset: number; limit: number }
): Promise<LeadRow[]> {
  const { rows } = await searchLeads(filters, { statuses: [options.status], sort: options.sort, desc: options.desc, limit: options.limit, offset: options.offset });
  return rows;
}

/** Every lead matching the filters, one batch at a time, for a CSV export. */
export async function exportLeadsBatch(
  filters: LeadFilters,
  options: { statuses: string[] | null; sort: LeadSort; desc: boolean; offset: number }
): Promise<{ rows: LeadRow[]; total: number }> {
  return searchLeads(filters, { ...options, limit: MAX_EXPORT_ROWS });
}

export async function bulkUpdateLeads(
  leadIds: string[],
  change: { status?: LeadStatus; assigneeId?: string | null }
): Promise<{ error?: string; updated?: number }> {
  if (leadIds.length === 0 || leadIds.length > MAX_BULK_LEADS) return { error: `Select between 1 and ${MAX_BULK_LEADS} leads.` };
  if (change.status && !ALL_STATUSES.includes(change.status)) return { error: "That isn't a valid stage." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const update = {
    ...(change.status ? { status: change.status } : {}),
    ...(change.assigneeId !== undefined ? { assigned_to: change.assigneeId } : {}),
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
