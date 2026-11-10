"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  BMC_BLOCKS,
  CONSULTANT_EXPERIENCE,
  ENTRY_POINTS,
  FLAGS,
  QUESTION_IDS,
  completionScore,
  isBlockStatus,
  type BlockStatus,
} from "@/lib/discovery/questionnaire";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 10_000;
// A lead at either of these stages moves to Discovery Meeting when a call is logged.
const BEFORE_DISCOVERY = ["engagement", "in_contact"];

type ActionResult = { error?: string };

function revalidateCall(leadId: string, companyId: string, callId?: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/leads");
  if (callId) revalidatePath(`/leads/${leadId}/discovery/${callId}`);
}

/** Starts a discovery call for a lead, filled in with today and its primary contact. */
export async function createDiscoveryCall(leadId: string): Promise<{ error?: string; callId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const { data: lead } = await supabase.from("leads").select("id, company_id, status").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "That lead wasn't found." };
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("lead_id", leadId)
    .order("is_primary", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: call, error } = await supabase
    .from("discovery_calls")
    .insert({
      lead_id: leadId,
      company_id: lead.company_id,
      contact_id: contact?.id ?? null,
      prospect_name: contact?.full_name ?? null,
      call_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" }),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !call) return { error: "The discovery call wasn't started. Please try again." };

  if (BEFORE_DISCOVERY.includes(lead.status)) {
    await supabase.from("leads").update({ status: "discovery_meeting" }).eq("id", leadId);
  }
  await supabase.from("activities").insert({ lead_id: leadId, actor_id: user.id, type: "note", body: "Discovery call started" });

  revalidateCall(leadId, lead.company_id);
  return { callId: call.id };
}

export type DiscoveryPatch = {
  prospectName?: string | null;
  contactId?: string | null;
  callDate?: string;
  includeExpansion?: boolean;
  answers?: Record<string, string>;
  blockStatus?: Record<string, BlockStatus>;
  consultantExperience?: string | null;
  consultantNotes?: string | null;
  pricingDiscussed?: boolean | null;
  decisionMakerPresent?: boolean | null;
  flags?: string[];
  recommendedEntry?: string | null;
  entryReason?: string | null;
};

/** Saves part of a call. The score is always worked out here from the block marks. */
export async function saveDiscoveryCall(callId: string, patch: DiscoveryPatch): Promise<ActionResult & { score?: number }> {
  const update: Database["public"]["Tables"]["discovery_calls"]["Update"] = {};

  if (patch.prospectName !== undefined) update.prospect_name = patch.prospectName?.trim().slice(0, 200) || null;
  if (patch.contactId !== undefined) update.contact_id = patch.contactId || null;
  if (patch.callDate !== undefined) {
    if (!DATE.test(patch.callDate)) return { error: "Enter a valid call date." };
    update.call_date = patch.callDate;
  }
  if (patch.includeExpansion !== undefined) update.include_expansion = Boolean(patch.includeExpansion);
  if (patch.answers !== undefined) {
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch.answers)) {
      if (!QUESTION_IDS.has(key)) return { error: "That question isn't on the questionnaire." };
      if (typeof value !== "string") return { error: "Notes must be text." };
      if (value.length > MAX_NOTE) return { error: "One of the notes is too long." };
      if (value.trim()) answers[key] = value;
    }
    update.answers = answers;
  }
  if (patch.blockStatus !== undefined) {
    const status: Record<string, BlockStatus> = {};
    for (const [key, value] of Object.entries(patch.blockStatus)) {
      if (!(BMC_BLOCKS as readonly string[]).includes(key) || !isBlockStatus(value)) return { error: "That isn't a valid block mark." };
      status[key] = value;
    }
    update.block_status = status;
    update.score = completionScore(status);
  }
  if (patch.consultantExperience !== undefined) {
    if (patch.consultantExperience && !CONSULTANT_EXPERIENCE.some(([key]) => key === patch.consultantExperience)) {
      return { error: "Choose good, bad, none or unknown." };
    }
    update.consultant_experience = patch.consultantExperience || null;
  }
  if (patch.consultantNotes !== undefined) update.consultant_notes = patch.consultantNotes?.slice(0, MAX_NOTE) || null;
  if (patch.pricingDiscussed !== undefined) update.pricing_discussed = patch.pricingDiscussed;
  if (patch.decisionMakerPresent !== undefined) update.decision_maker_present = patch.decisionMakerPresent;
  if (patch.flags !== undefined) {
    if (!patch.flags.every((f) => FLAGS.some(([key]) => key === f))) return { error: "That isn't a valid flag." };
    update.flags = [...new Set(patch.flags)];
  }
  if (patch.recommendedEntry !== undefined) {
    if (patch.recommendedEntry && !(ENTRY_POINTS as readonly string[]).includes(patch.recommendedEntry)) return { error: "Choose an entry point from the list." };
    update.recommended_entry = patch.recommendedEntry || null;
  }
  if (patch.entryReason !== undefined) update.entry_reason = patch.entryReason?.slice(0, 1000) || null;
  if (Object.keys(update).length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discovery_calls")
    .update(update)
    .eq("id", callId)
    .select("lead_id, company_id, score")
    .single();
  if (error || !data) return { error: "That didn't save. Please try again." };

  revalidateCall(data.lead_id, data.company_id, callId);
  return { score: Number(data.score) };
}

export async function deleteDiscoveryCall(callId: string): Promise<ActionResult & { leadId?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("discovery_calls").delete().eq("id", callId).select("lead_id, company_id").single();
  if (error || !data) return { error: "The call wasn't deleted. Please try again." };
  revalidateCall(data.lead_id, data.company_id);
  return { leadId: data.lead_id };
}
