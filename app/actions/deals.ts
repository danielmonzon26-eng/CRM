"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DealStage } from "@/lib/supabase/types";
import { DEAL_STAGE_META } from "@/lib/deals/stages";

function revalidateDealPaths(dealId: string, leadId: string | null, companyId: string) {
  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/companies/${companyId}`);
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function createDeal(input: {
  name: string;
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  amount: number;
  expectedCloseDate: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      name: input.name,
      company_id: input.companyId,
      lead_id: input.leadId,
      primary_contact_id: input.primaryContactId,
      amount: input.amount,
      expected_close_date: input.expectedCloseDate,
      owner: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("deal_stage_history").insert({
    deal_id: deal.id,
    from_stage: null,
    to_stage: "discovery_scheduled",
    changed_by: user?.id ?? null,
  });

  if (input.leadId) {
    await supabase.from("activities").insert({
      lead_id: input.leadId,
      actor_id: user?.id ?? null,
      type: "deal_created",
      body: `Deal "${input.name}" created ($${input.amount.toLocaleString()})`,
    });
  }

  revalidateDealPaths(deal.id, input.leadId, input.companyId);
  return deal.id;
}

export async function updateDealStage(dealId: string, newStage: DealStage, lostReason?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("stage, lead_id, company_id, name")
    .eq("id", dealId)
    .single();
  if (fetchError) throw fetchError;

  if (newStage === "closed_lost" && !lostReason?.trim()) {
    throw new Error("A lost reason is required when closing a deal as lost.");
  }

  const update: { stage: DealStage; lost_reason: string | null; closed_at?: string } = {
    stage: newStage,
    lost_reason: newStage === "closed_lost" ? lostReason!.trim() : null,
  };
  if (newStage === "closed_won" || newStage === "closed_lost") {
    update.closed_at = new Date().toISOString();
  }

  const { error } = await supabase.from("deals").update(update).eq("id", dealId);
  if (error) throw error;

  await supabase.from("deal_stage_history").insert({
    deal_id: dealId,
    from_stage: deal.stage,
    to_stage: newStage,
    changed_by: user?.id ?? null,
  });

  if (deal.lead_id) {
    await supabase.from("activities").insert({
      lead_id: deal.lead_id,
      actor_id: user?.id ?? null,
      type: "deal_stage_change",
      body: `Deal "${deal.name}" moved to ${DEAL_STAGE_META[newStage].label}`,
    });
  }

  revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
}

type DealFieldUpdate =
  | { field: "amount"; value: number }
  | { field: "expected_close_date"; value: string }
  | { field: "next_step"; value: string | null }
  | { field: "next_step_due_date"; value: string | null }
  | { field: "competitors"; value: string | null }
  | { field: "notes"; value: string | null }
  | { field: "probability"; value: number | null };

export async function updateDealField(dealId: string, field: DealFieldUpdate["field"], value: DealFieldUpdate["value"]) {
  const supabase = await createClient();
  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("lead_id, company_id")
    .eq("id", dealId)
    .single();
  if (fetchError) throw fetchError;

  let updateError;
  switch (field) {
    case "amount":
      updateError = (await supabase.from("deals").update({ amount: value as number }).eq("id", dealId)).error;
      break;
    case "expected_close_date":
      updateError = (await supabase.from("deals").update({ expected_close_date: value as string }).eq("id", dealId)).error;
      break;
    case "next_step":
      updateError = (await supabase.from("deals").update({ next_step: value as string | null }).eq("id", dealId)).error;
      break;
    case "next_step_due_date":
      updateError = (await supabase.from("deals").update({ next_step_due_date: value as string | null }).eq("id", dealId)).error;
      break;
    case "competitors":
      updateError = (await supabase.from("deals").update({ competitors: value as string | null }).eq("id", dealId)).error;
      break;
    case "notes":
      updateError = (await supabase.from("deals").update({ notes: value as string | null }).eq("id", dealId)).error;
      break;
    case "probability":
      updateError = (await supabase.from("deals").update({ probability: value as number | null }).eq("id", dealId)).error;
      break;
  }
  if (updateError) throw updateError;

  revalidateDealPaths(dealId, deal.lead_id, deal.company_id);
}
