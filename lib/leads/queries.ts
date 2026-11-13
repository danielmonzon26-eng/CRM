import { createClient } from "@/lib/supabase/server";
import type { ActivityType, LeadEngagement, LeadStatus, UserRole } from "@/lib/supabase/types";
import type { QuickEditRecord } from "@/lib/leads/quick-edit";
import type { ScoreReason } from "@/lib/leads/scoring";
import { personName } from "@/lib/team/names";

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
  // Alphabetical by name (email when there's no name), for every people dropdown.
  return data
    // fullName is never empty: without a saved name, one is made from the email.
    .map((p) => ({ id: p.id, email: p.email, fullName: personName(p.full_name, p.email), role: p.role }))
    .sort((a, b) => (a.fullName?.trim() || a.email || "").localeCompare(b.fullName?.trim() || b.email || ""));
}

/** Current values for the quick edit popup, including the primary contact the Leads table shows. */
export async function getLeadQuickEdit(leadId: string): Promise<QuickEditRecord | null> {
  const supabase = await createClient();

  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadError) throw leadError;
  if (!lead) return null;

  const [{ data: company, error: companyError }, { data: contacts, error: contactsError }] = await Promise.all([
    supabase.from("companies").select("name, industry, community, website, phone").eq("id", lead.company_id).single(),
    supabase.from("contacts").select("id, full_name, title, email, phone").eq("lead_id", leadId).order("is_primary", { ascending: false }).order("created_at"),
  ]);
  if (companyError) throw companyError;
  if (contactsError) throw contactsError;

  const contact = contacts[0] ?? null;
  return {
    leadId,
    contactId: contact?.id ?? null,
    otherContacts: Math.max(contacts.length - 1, 0),
    values: {
      status: lead.status,
      engagement: lead.engagement,
      clientType: lead.client_type ?? "",
      programs: lead.programs,
      companyName: company.name,
      industry: company.industry ?? "",
      community: company.community ?? "",
      website: company.website ?? "",
      companyPhone: company.phone ?? "",
      contactName: contact?.full_name ?? "",
      contactTitle: contact?.title ?? "",
      contactEmail: contact?.email ?? "",
      contactPhone: contact?.phone ?? "",
    },
  };
}

export type LeadDetail = {
  id: string;
  status: LeadStatus;
  engagement: LeadEngagement;
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
    engagement: lead.engagement,
    score: lead.score,
    scoreReasons: Array.isArray(lead.score_reasons) ? (lead.score_reasons as ScoreReason[]) : [],
    assignedTo: lead.assigned_to,
    company,
    contacts: contacts ?? [],
    activities: activities ?? [],
  };
}
