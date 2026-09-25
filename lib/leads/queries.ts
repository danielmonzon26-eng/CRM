import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { ActivityType, LeadStatus, UserRole } from "@/lib/supabase/types";
import type { ScoreReason } from "@/lib/leads/scoring";

/**
 * Reads here use the session-scoped server client (lib/supabase/server.ts), so RLS
 * governs access per signed-in user rather than bypassing it. Every function in this
 * file must therefore be called from a request context with a valid session (a Server
 * Component or Server Action on a route the middleware already protects).
 */

export type PipelineStats = {
  total: number;
  newThisWeek: number;
  byStatus: Record<LeadStatus, number>;
};

const EMPTY_STATUS_COUNTS: Record<LeadStatus, number> = {
  new: 0,
  researching: 0,
  contacted: 0,
  qualified: 0,
  unqualified: 0,
  won: 0,
  lost: 0,
};

export async function getPipelineStats(): Promise<PipelineStats> {
  const supabase = await createClient();
  const rows = await fetchAllPages((from, to) =>
    supabase.from("leads").select("status, created_at").range(from, to)
  );

  const byStatus = { ...EMPTY_STATUS_COUNTS };
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let newThisWeek = 0;

  for (const row of rows) {
    byStatus[row.status]++;
    if (new Date(row.created_at).getTime() >= weekAgo) newThisWeek++;
  }

  return { total: rows.length, newThisWeek, byStatus };
}

export type TeamMember = { id: string; email: string | null; fullName: string | null; role: UserRole };

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, email, full_name, role").order("email");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, email: p.email, fullName: p.full_name, role: p.role }));
}

export type BoardLead = {
  id: string;
  status: LeadStatus;
  score: number;
  companyName: string;
  community: string | null;
  industry: string | null;
  primaryContact: { fullName: string; title: string | null } | null;
  contactCount: number;
};

export async function getLeadsBoard(): Promise<BoardLead[]> {
  const supabase = await createClient();

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, status, score, company_id").range(from, to)
  );
  if (leads.length === 0) return [];

  const companyIds = [...new Set(leads.map((l) => l.company_id))];
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, community, industry")
    .in("id", companyIds);
  if (companiesError) throw companiesError;
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("lead_id, full_name, title, is_primary")
    .in(
      "lead_id",
      leads.map((l) => l.id)
    );
  if (contactsError) throw contactsError;

  const contactsByLead = new Map<string, { full_name: string; title: string | null; is_primary: boolean }[]>();
  for (const c of contacts) {
    const list = contactsByLead.get(c.lead_id) ?? [];
    list.push(c);
    contactsByLead.set(c.lead_id, list);
  }

  return leads.map((lead) => {
    const company = companyById.get(lead.company_id);
    const leadContacts = contactsByLead.get(lead.id) ?? [];
    const primary = leadContacts.find((c) => c.is_primary) ?? leadContacts[0] ?? null;

    return {
      id: lead.id,
      status: lead.status,
      score: lead.score,
      companyName: company?.name ?? "Unknown company",
      community: company?.community ?? null,
      industry: company?.industry ?? null,
      primaryContact: primary ? { fullName: primary.full_name, title: primary.title } : null,
      contactCount: leadContacts.length,
    };
  });
}

export type LeadDetail = {
  id: string;
  status: LeadStatus;
  score: number;
  scoreReasons: ScoreReason[];
  assignedTo: string | null;
  company: {
    id: string;
    name: string;
    address_line: string | null;
    community: string | null;
    industry: string | null;
    website: string | null;
    domain: string | null;
    phone: string | null;
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
    status: lead.status,
    score: lead.score,
    scoreReasons: Array.isArray(lead.score_reasons) ? (lead.score_reasons as ScoreReason[]) : [],
    assignedTo: lead.assigned_to,
    company,
    contacts: contacts ?? [],
    activities: activities ?? [],
  };
}
