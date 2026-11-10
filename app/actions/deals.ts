"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database, DealPayment, DealStage } from "@/lib/supabase/types";
import { DEAL_STAGE_META, OPEN_DEAL_STAGES, PAYMENT_LABELS, isDealStage } from "@/lib/deals/stages";
import { isLeadProgram, programLabel } from "@/lib/leads/classification";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type ActionResult = { error?: string };

function revalidateDealPaths(dealId: string, leadId: string | null, companyId: string) {
  revalidatePath("/crm");
  revalidatePath("/leads");
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/companies/${companyId}`);
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
}

function checkWorkTypes(workTypes: string[]): string | null {
  return workTypes.every(isLeadProgram) ? null : "Pick work from the list.";
}

/** Team members who can be put on a proposal. */
export async function listProposalStaff(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, email, full_name").order("full_name");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Unnamed user" }));
}

export type CreateDealInput = {
  name: string;
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  amount: number;
  expectedCloseDate: string;
  stage?: DealStage;
  workTypes?: string[];
  staffIds?: string[];
  payment?: DealPayment | null;
  sentOn?: string | null;
};

export async function createDeal(input: CreateDealInput): Promise<string> {
  const stage = input.stage ?? OPEN_DEAL_STAGES[0];
  if (!OPEN_DEAL_STAGES.includes(stage)) throw new Error("A new proposal starts as In Development or Sent.");
  if (!input.name.trim()) throw new Error("Give the proposal a name.");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Enter a valid amount.");
  if (!DATE.test(input.expectedCloseDate)) throw new Error("Enter a valid decision date.");
  const workTypes = [...new Set(input.workTypes ?? [])];
  const workError = checkWorkTypes(workTypes);
  if (workError) throw new Error(workError);
  if (input.sentOn && !DATE.test(input.sentOn)) throw new Error("Enter a valid sent date.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      name: input.name.trim(),
      stage,
      company_id: input.companyId,
      lead_id: input.leadId,
      primary_contact_id: input.primaryContactId,
      amount: input.amount,
      expected_close_date: input.expectedCloseDate,
      work_types: workTypes,
      payment: input.payment ?? null,
      sent_on: stage === "sent" ? input.sentOn || today() : null,
      owner: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const staffIds = [...new Set(input.staffIds ?? [])];
  if (staffIds.length > 0) {
    const { error: staffError } = await supabase.from("deal_staff").insert(staffIds.map((user_id) => ({ deal_id: deal.id, user_id })));
    if (staffError) throw staffError;
  }

  await supabase.from("deal_stage_history").insert({ deal_id: deal.id, from_stage: null, to_stage: stage, changed_by: user?.id ?? null });

  if (input.leadId) {
    await supabase.from("activities").insert({
      lead_id: input.leadId,
      actor_id: user?.id ?? null,
      type: "deal_created",
      body: `Proposal "${input.name.trim()}" created ($${input.amount.toLocaleString()})${workTypes.length ? ` for ${workTypes.map(programLabel).join(", ")}` : ""}`,
    });
  }

  revalidateDealPaths(deal.id, input.leadId, input.companyId);
  return deal.id;
}

/**
 * Moves a proposal. Sent and accepted dates fill in with today when they're blank, and the
 * accepted date clears if it moves back out of Accepted.
 */
export async function updateDealStage(dealId: string, newStage: DealStage, declinedReason?: string | null) {
  if (!isDealStage(newStage)) throw new Error("That isn't a proposal stage.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("stage, lead_id, company_id, name, sent_on, accepted_on, lost_reason")
    .eq("id", dealId)
    .single();
  if (fetchError) throw fetchError;
  if (deal.stage === newStage) return;

  const closed = newStage === "accepted" || newStage === "declined";
  const { error } = await supabase
    .from("deals")
    .update({
      stage: newStage,
      lost_reason: newStage === "declined" ? declinedReason?.trim() || deal.lost_reason || null : null,
      closed_at: closed ? new Date().toISOString() : null,
      sent_on: newStage !== "in_development" ? deal.sent_on ?? today() : deal.sent_on,
      accepted_on: newStage === "accepted" ? deal.accepted_on ?? today() : null,
    })
    .eq("id", dealId);
  if (error) throw error;

  await supabase.from("deal_stage_history").insert({ deal_id: dealId, from_stage: deal.stage, to_stage: newStage, changed_by: user?.id ?? null });

  if (deal.lead_id) {
    await supabase.from("activities").insert({
      lead_id: deal.lead_id,
      actor_id: user?.id ?? null,
      type: "deal_stage_change",
      body: `Proposal "${deal.name}" moved to ${DEAL_STAGE_META[newStage].label}`,
    });
  }

  revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
}

export type DealDetailsPatch = {
  name?: string;
  amount?: number;
  expectedCloseDate?: string;
  workTypes?: string[];
  payment?: DealPayment | null;
  sentOn?: string | null;
  acceptedOn?: string | null;
  nextStep?: string | null;
  nextStepDueDate?: string | null;
  notes?: string | null;
  declinedReason?: string | null;
};

/** Saves any of a proposal's details. Each field is checked before anything is written. */
export async function updateDealDetails(dealId: string, patch: DealDetailsPatch): Promise<ActionResult> {
  const update: Database["public"]["Tables"]["deals"]["Update"] = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { error: "Give the proposal a name." };
    update.name = patch.name.trim();
  }
  if (patch.amount !== undefined) {
    if (!Number.isFinite(patch.amount) || patch.amount < 0) return { error: "Enter a valid amount." };
    update.amount = patch.amount;
  }
  if (patch.expectedCloseDate !== undefined) {
    if (!DATE.test(patch.expectedCloseDate)) return { error: "Enter a valid decision date." };
    update.expected_close_date = patch.expectedCloseDate;
  }
  if (patch.workTypes !== undefined) {
    const workTypes = [...new Set(patch.workTypes)];
    const workError = checkWorkTypes(workTypes);
    if (workError) return { error: workError };
    update.work_types = workTypes;
  }
  if (patch.payment !== undefined) {
    if (patch.payment !== null && !(patch.payment in PAYMENT_LABELS)) return { error: "Choose paid or unpaid." };
    update.payment = patch.payment;
  }
  for (const value of [patch.sentOn, patch.acceptedOn, patch.nextStepDueDate]) {
    if (value && !DATE.test(value)) return { error: "Enter a valid date." };
  }
  if (patch.sentOn !== undefined) update.sent_on = patch.sentOn;
  if (patch.acceptedOn !== undefined) update.accepted_on = patch.acceptedOn;
  if (patch.nextStepDueDate !== undefined) update.next_step_due_date = patch.nextStepDueDate;
  if (patch.nextStep !== undefined) update.next_step = patch.nextStep?.trim() || null;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.declinedReason !== undefined) update.lost_reason = patch.declinedReason?.trim() || null;
  if (Object.keys(update).length === 0) return {};

  const supabase = await createClient();
  const { data: deal, error } = await supabase.from("deals").update(update).eq("id", dealId).select("lead_id, company_id").single();
  if (error) {
    return { error: error.message.includes("lost_reason") ? "A reason can only be saved on a declined proposal." : "That change didn't save. Please try again." };
  }

  revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
  return {};
}

/** Replaces who is working on the proposal. */
export async function setDealStaff(dealId: string, userIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const wanted = [...new Set(userIds)];
  const { data: current, error } = await supabase.from("deal_staff").select("user_id").eq("deal_id", dealId);
  if (error) return { error: "Staff didn't save. Please try again." };

  const have = new Set(current.map((r) => r.user_id));
  const add = wanted.filter((id) => !have.has(id));
  const remove = [...have].filter((id) => !wanted.includes(id));
  if (add.length) {
    const { error: addError } = await supabase.from("deal_staff").insert(add.map((user_id) => ({ deal_id: dealId, user_id })));
    if (addError) return { error: "Staff didn't save. Please try again." };
  }
  if (remove.length) {
    const { error: removeError } = await supabase.from("deal_staff").delete().eq("deal_id", dealId).in("user_id", remove);
    if (removeError) return { error: "Staff didn't save. Please try again." };
  }

  const { data: deal } = await supabase.from("deals").select("lead_id, company_id").eq("id", dealId).single();
  if (deal) revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
  return {};
}

/** Records a proposal file the browser has already uploaded to the proposal-files bucket. */
export async function addDealFile(
  dealId: string,
  file: { name: string; path: string; size: number; type: string }
): Promise<ActionResult> {
  if (!file.path.startsWith(`${dealId}/`)) return { error: "That upload doesn't belong to this proposal." };
  if (file.size > MAX_FILE_BYTES) return { error: "Files can be up to 50 MB." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("deal_files").insert({
    deal_id: dealId,
    file_name: file.name.slice(0, 255),
    storage_path: file.path,
    size_bytes: file.size,
    content_type: file.type || null,
    uploaded_by: user?.id ?? null,
  });
  if (error) {
    await supabase.storage.from("proposal-files").remove([file.path]);
    return { error: `${file.name} wasn't saved. Please try again.` };
  }

  const { data: deal } = await supabase.from("deals").select("lead_id, company_id, name").eq("id", dealId).single();
  if (deal) {
    if (deal.lead_id) {
      await supabase.from("activities").insert({
        lead_id: deal.lead_id,
        actor_id: user?.id ?? null,
        type: "note",
        body: `Uploaded ${file.name} to proposal "${deal.name}"`,
      });
    }
    revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
  }
  return {};
}

export async function deleteDealFile(fileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: file, error } = await supabase.from("deal_files").select("deal_id, storage_path").eq("id", fileId).maybeSingle();
  if (error || !file) return { error: "That file wasn't found." };

  const { error: storageError } = await supabase.storage.from("proposal-files").remove([file.storage_path]);
  if (storageError) return { error: "The file wasn't deleted. Please try again." };
  await supabase.from("deal_files").delete().eq("id", fileId);

  const { data: deal } = await supabase.from("deals").select("lead_id, company_id").eq("id", file.deal_id).single();
  if (deal) revalidateDealPaths(file.deal_id, deal.lead_id, deal.company_id);
  return {};
}
