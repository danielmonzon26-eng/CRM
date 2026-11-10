import { createClient } from "@/lib/supabase/server";
import type { BlockStatus, ConsultantExperience } from "./questionnaire";

export type DiscoveryCall = {
  id: string;
  leadId: string;
  companyId: string;
  contactId: string | null;
  prospectName: string | null;
  callDate: string;
  includeExpansion: boolean;
  answers: Record<string, string>;
  blockStatus: Record<string, BlockStatus>;
  score: number;
  consultantExperience: ConsultantExperience | null;
  consultantNotes: string | null;
  pricingDiscussed: boolean | null;
  decisionMakerPresent: boolean | null;
  flags: string[];
  recommendedEntry: string | null;
  entryReason: string | null;
  createdBy: string | null;
  updatedAt: string;
};

type Row = {
  id: string;
  lead_id: string;
  company_id: string;
  contact_id: string | null;
  prospect_name: string | null;
  call_date: string;
  include_expansion: boolean;
  answers: Record<string, string>;
  block_status: Record<string, string>;
  score: number;
  consultant_experience: string | null;
  consultant_notes: string | null;
  pricing_discussed: boolean | null;
  decision_maker_present: boolean | null;
  flags: string[];
  recommended_entry: string | null;
  entry_reason: string | null;
  created_by: string | null;
  updated_at: string;
};

function toCall(r: Row): DiscoveryCall {
  return {
    id: r.id,
    leadId: r.lead_id,
    companyId: r.company_id,
    contactId: r.contact_id,
    prospectName: r.prospect_name,
    callDate: r.call_date,
    includeExpansion: r.include_expansion,
    answers: r.answers ?? {},
    blockStatus: (r.block_status ?? {}) as Record<string, BlockStatus>,
    score: Number(r.score),
    consultantExperience: r.consultant_experience as ConsultantExperience | null,
    consultantNotes: r.consultant_notes,
    pricingDiscussed: r.pricing_discussed,
    decisionMakerPresent: r.decision_maker_present,
    flags: r.flags ?? [],
    recommendedEntry: r.recommended_entry,
    entryReason: r.entry_reason,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
  };
}

/** A lead's discovery calls, latest first. */
export async function getDiscoveryCalls(leadId: string): Promise<DiscoveryCall[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discovery_calls")
    .select("*")
    .eq("lead_id", leadId)
    .order("call_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCall);
}

export async function getDiscoveryCall(callId: string): Promise<DiscoveryCall | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("discovery_calls").select("*").eq("id", callId).maybeSingle();
  if (error) throw error;
  return data ? toCall(data) : null;
}
