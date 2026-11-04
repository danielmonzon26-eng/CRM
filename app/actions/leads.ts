"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientTypeLabel, isClientType, isLeadProgram, programLabel } from "@/lib/leads/classification";
import { ALL_STATUSES, type LeadFilters, type LeadSort } from "@/lib/leads/filters";
import { getLeadQuickEdit } from "@/lib/leads/queries";
import {
  COMPANY_FIELD_LABELS,
  CONTACT_FIELD_LABELS,
  checkQuickEditChanges,
  type QuickEditChanges,
  type QuickEditRecord,
} from "@/lib/leads/quick-edit";
import { searchLeads, type LeadRow } from "@/lib/leads/search";
import type { LeadStatus } from "@/lib/supabase/types";
import { extractDomain } from "@/lib/text";

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

export async function loadLeadQuickEdit(leadId: string): Promise<QuickEditRecord | null> {
  return getLeadQuickEdit(leadId);
}

function changedLabels(changes: QuickEditChanges, labels: Record<string, string>): string[] {
  return Object.keys(labels).filter((key) => key in changes).map((key) => labels[key]);
}

/** Saves the fields changed in the quick edit popup across the lead, its company, and its primary contact. */
export async function saveLeadQuickEdit(
  record: { leadId: string; contactId: string | null },
  submitted: QuickEditChanges
): Promise<{ error?: string }> {
  const checked = checkQuickEditChanges(submitted, Boolean(record.contactId));
  if ("error" in checked) return checked;
  const { changes } = checked;
  const { leadId, contactId } = record;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead, error: leadError } = await supabase.from("leads").select("company_id").eq("id", leadId).single();
  if (leadError) return { error: leadError.message };

  const activity: { type: "note" | "status_change"; body: string }[] = [];

  const leadUpdate = {
    ...(changes.status ? { status: changes.status } : {}),
    ...(changes.assignedTo !== undefined ? { assigned_to: changes.assignedTo || null } : {}),
    ...(changes.clientType !== undefined ? { client_type: changes.clientType || null } : {}),
    ...(changes.programs ? { programs: changes.programs } : {}),
  };
  if (Object.keys(leadUpdate).length > 0) {
    const { error } = await supabase.from("leads").update(leadUpdate).eq("id", leadId).select("id").single();
    if (error) return { error: error.message };

    if (changes.status) activity.push({ type: "status_change", body: `Status changed to "${changes.status}"` });
    if (changes.assignedTo !== undefined) {
      const { data: assignee } = changes.assignedTo
        ? await supabase.from("profiles").select("email, full_name").eq("id", changes.assignedTo).maybeSingle()
        : { data: null };
      activity.push({ type: "status_change", body: assignee ? `Assigned to ${assignee.full_name ?? assignee.email ?? "a team member"}` : "Unassigned" });
    }
    if (changes.clientType !== undefined) activity.push({ type: "note", body: `Client type set to ${clientTypeLabel(changes.clientType) ?? "not set"}` });
    if (changes.programs) activity.push({ type: "note", body: `Programs set to ${changes.programs.length ? changes.programs.map(programLabel).join(", ") : "none"}` });
  }

  const companyFields = changedLabels(changes, COMPANY_FIELD_LABELS);
  if (companyFields.length > 0) {
    // normalized_name stays as it was: it's how licence syncs find this company, so a rename
    // here doesn't create a duplicate company the next time its licence comes through.
    const { error } = await supabase
      .from("companies")
      .update({
        ...(changes.companyName ? { name: changes.companyName } : {}),
        ...(changes.industry !== undefined ? { industry: changes.industry || null } : {}),
        ...(changes.community !== undefined ? { community: changes.community || null } : {}),
        ...(changes.website !== undefined ? { website: changes.website || null, domain: extractDomain(changes.website) } : {}),
        ...(changes.companyPhone !== undefined ? { phone: changes.companyPhone || null } : {}),
      })
      .eq("id", lead.company_id)
      .select("id")
      .single();
    if (error) return { error: `Some changes saved, but not the company details: ${error.message}` };
    activity.push({ type: "note", body: `Updated company ${companyFields.join(", ")}` });
  }

  const contactFields = changedLabels(changes, CONTACT_FIELD_LABELS);
  if (contactFields.length > 0 && contactId) {
    const { error } = await supabase
      .from("contacts")
      .update({
        ...(changes.contactName ? { full_name: changes.contactName } : {}),
        ...(changes.contactTitle !== undefined ? { title: changes.contactTitle || null } : {}),
        // The confidence score described the old address, so it goes with it.
        ...(changes.contactEmail !== undefined ? { email: changes.contactEmail || null, email_confidence: null } : {}),
        ...(changes.contactPhone !== undefined ? { phone: changes.contactPhone || null } : {}),
      })
      .eq("id", contactId)
      .eq("lead_id", leadId)
      .select("id")
      .single();
    if (error) return { error: `Some changes saved, but not the contact details: ${error.message}` };
    activity.push({ type: "note", body: `Updated contact ${contactFields.join(", ")}` });
  } else if (changes.contactName) {
    const { error } = await supabase.from("contacts").insert({
      lead_id: leadId,
      full_name: changes.contactName,
      title: changes.contactTitle || null,
      email: changes.contactEmail || null,
      phone: changes.contactPhone || null,
      source: "manual",
      is_primary: true,
    });
    if (error) return { error: `Some changes saved, but not the contact details: ${error.message}` };
    activity.push({ type: "note", body: `Added contact: ${changes.contactName}` });
  }

  if (activity.length > 0) {
    await supabase.from("activities").insert(activity.map((entry) => ({ ...entry, lead_id: leadId, actor_id: user?.id ?? null })));
  }

  revalidatePath("/");
  revalidateLeadLists();
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/companies");
  revalidatePath(`/companies/${lead.company_id}`);
  revalidatePath("/contacts");
  return {};
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
