import { createClient } from "@/lib/supabase/server";
import type { ActivityType, LeadStatus, UserRole } from "@/lib/supabase/types";
import type { ScoreReason } from "@/lib/leads/scoring";

/**
 * Reads here use the session-scoped server client (lib/supabase/server.ts), so RLS
 * governs access per signed-in user rather than bypassing it. Every function in this
 * file must therefore be called from a request context with a valid session (a Server
 * Component or Server Action on a route the middleware already protects).
 */

export type TeamMember = { id: string; email: string | null; fullName: string | null; role: UserRole };

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, email, full_name, role").order("email");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, email: p.email, fullName: p.full_name, role: p.role }));
}

export type LeadDetail = {
  id: string;
  status: LeadStatus;
  score: number;
  scoreReasons: ScoreReason[];
  assignedTo: string | null;
  clientType: string | null;
  programs: string[];
  company: {
    id: string;
    name: string;
    address_line: string | null;
    community: string | null;
    industry: string | null;
    website: string | null;
    domain: string | null;
    phone: string | null;
    estimated_annual_revenue: number | null;
  };
  contacts: {
    id: string;
    full_name: string;
    title: string | null;
    email: string | null;
    email_confidence: number | null;
    phone: string | null;
    linkedin_url: string | null;
    is_primary: boolean;
  }[];
  activities: { id: string; type: ActivityType; body: string | null; created_at: string }[];
};

export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const supabase = await createClient();

  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadError) throw leadError;
  if (!lead) return null;

  const [{ data: company, error: companyError }, { data: contacts, error: contactsError }, { data: activities, error: activitiesError }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", lead.company_id).single(),
      supabase.from("contacts").select("*").eq("lead_id", leadId).order("is_primary", { ascending: false }),
      supabase.from("activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    ]);
  if (companyError) throw companyError;
  if (contactsError) throw contactsError;
  if (activitiesError) throw activitiesError;

  return {
    id: lead.id,
    clientType: lead.client_type,
    programs: lead.programs,
    status: lead.status,
    score: lead.score,
    scoreReasons: Array.isArray(lead.score_reasons) ? (lead.score_reasons as ScoreReason[]) : [],
    assignedTo: lead.assigned_to,
    company,
    contacts: contacts ?? [],
    activities: activities ?? [],
  };
}
