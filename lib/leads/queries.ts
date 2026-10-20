import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { ActivityType, LeadStatus, UserRole } from "@/lib/supabase/types";
import type { ScoreReason } from "@/lib/leads/scoring";

/**
 * Reads here use the session-scoped server client (lib/supabase/server.ts), so RLS
 * governs access per signed-in user rather than bypassing it. Every function in this
 * file must therefore be called from a request context with a valid session (a Server
 * Component or Server Action on a route the middleware already protects) --
 * EXCEPT getPipelineStats/getLeadsBoard, see the TEMPORARY note on each below.
 */

export type PipelineStats = {
  total: number;
  newThisWeek: number;
  byStatus: Record<LeadStatus, number>;
};

export type LeadTableRow = {
  id: string;
  status: LeadStatus;
  score: number;
  createdAt: string;
  companyId: string;
  companyName: string;
  community: string | null;
  industry: string | null;
  primaryContact: { fullName: string; title: string | null; email: string | null } | null;
};

export type LeadTablePage = {
  rows: LeadTableRow[];
  total: number;
  page: number;
  pageSize: number;
};

type LeadTableQueryRow = {
  id: string;
  status: LeadStatus;
  score: number;
  created_at: string;
  company_id: string;
  companies: { name: string; community: string | null; industry: string | null } | null;
  contacts: { full_name: string; title: string | null; email: string | null; is_primary: boolean }[];
};

/**
 * Server-side paginated + filtered lead table. Filters the embedded `companies`
 * resource via PostgREST's `!inner` join syntax (a real SQL WHERE, not a giant
 * `.in()` id list) so this stays cheap regardless of how many rows match.
 */
export async function getLeadsTable(opts: {
  search?: string;
  status?: LeadStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<LeadTablePage> {
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select(
      "id, status, score, created_at, company_id, companies!inner(name, community, industry), contacts(full_name, title, email, is_primary)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (opts.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }
  if (opts.search?.trim()) {
    query = query.ilike("companies.name", `%${opts.search.trim()}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as LeadTableQueryRow[]).map((row) => {
    const primary = row.contacts.find((c) => c.is_primary) ?? row.contacts[0] ?? null;
    return {
      id: row.id,
      status: row.status,
      score: row.score,
      createdAt: row.created_at,
      companyId: row.company_id,
      companyName: row.companies?.name ?? "Unknown company",
      community: row.companies?.community ?? null,
      industry: row.companies?.industry ?? null,
      primaryContact: primary ? { fullName: primary.full_name, title: primary.title, email: primary.email } : null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

const EMPTY_STATUS_COUNTS: Record<LeadStatus, number> = {
  new: 0,
  researching: 0,
  contacted: 0,
  qualified: 0,
  unqualified: 0,
  won: 0,
  lost: 0,
};

/**
 * TEMPORARY (requested 2026-10-06): uses the service-role client, not the
 * session-scoped one, because the pipeline board ("/") was made viewable without
 * login in middleware.ts for a first look at the UI -- an anonymous request has no
 * session, so the normal session-scoped client would return zero rows under RLS.
 * Switch back to createClient() once "/" requires login again.
 */
export async function getPipelineStats(): Promise<PipelineStats> {
  const supabase = createAdminClient();
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

/** TEMPORARY (requested 2026-10-06): see getPipelineStats' note above -- same reason. */
export async function getLeadsBoard(): Promise<BoardLead[]> {
  const supabase = createAdminClient();

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, status, score, company_id").range(from, to)
  );
  if (leads.length === 0) return [];

  const companies = await fetchAllPages((from, to) =>
    supabase.from("companies").select("id, name, community, industry").range(from, to)
  );
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const contacts = await fetchAllPages((from, to) =>
    supabase.from("contacts").select("lead_id, full_name, title, is_primary").range(from, to)
  );

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
    status: lead.status,
    score: lead.score,
    scoreReasons: Array.isArray(lead.score_reasons) ? (lead.score_reasons as ScoreReason[]) : [],
    assignedTo: lead.assigned_to,
    company,
    contacts: contacts ?? [],
    activities: activities ?? [],
  };
}
