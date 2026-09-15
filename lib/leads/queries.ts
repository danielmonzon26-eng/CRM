import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { ActivityType, LeadStatus } from "@/lib/supabase/types";
import type { ScoreReason } from "@/lib/leads/scoring";

/**
 * Reads here use the service-role client, not a signed-in user's session — there is
 * no auth yet (Step 7). RLS denies the anon role entirely, so this is the only way to
 * read data before then. Once Step 7 lands, this should move to the session-scoped
 * server client (lib/supabase/server.ts) so RLS actually governs access per user.
 */

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
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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
    company,
    contacts: contacts ?? [],
    activities: activities ?? [],
  };
}
