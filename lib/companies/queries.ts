import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { LeadStatus } from "@/lib/supabase/types";

export type CompanyListRow = {
  id: string;
  name: string;
  community: string | null;
  industry: string | null;
  estimatedAnnualRevenue: number | null;
  leadId: string | null;
  status: LeadStatus | null;
  score: number | null;
  contactCount: number;
};

export async function getCompaniesList(search?: string): Promise<CompanyListRow[]> {
  const supabase = await createClient();

  let companyQuery = supabase
    .from("companies")
    .select("id, name, community, industry, estimated_annual_revenue")
    .order("name");
  if (search?.trim()) {
    companyQuery = companyQuery.ilike("name", `%${search.trim()}%`);
  }

  const companies = await fetchAllPages((from, to) => companyQuery.range(from, to));
  if (companies.length === 0) return [];

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, company_id, status, score").range(from, to)
  );
  const leadByCompany = new Map(leads.map((l) => [l.company_id, l]));

  const contacts = await fetchAllPages((from, to) =>
    supabase.from("contacts").select("lead_id").range(from, to)
  );
  const contactCounts = new Map<string, number>();
  for (const c of contacts) {
    contactCounts.set(c.lead_id, (contactCounts.get(c.lead_id) ?? 0) + 1);
  }

  return companies.map((c) => {
    const lead = leadByCompany.get(c.id);
    return {
      id: c.id,
      name: c.name,
      community: c.community,
      industry: c.industry,
      estimatedAnnualRevenue: c.estimated_annual_revenue,
      leadId: lead?.id ?? null,
      status: lead?.status ?? null,
      score: lead?.score ?? null,
      contactCount: lead ? contactCounts.get(lead.id) ?? 0 : 0,
    };
  });
}

export type CompanyDetail = {
  id: string;
  name: string;
  address_line: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  community: string | null;
  industry: string | null;
  naics_code: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  estimated_annual_revenue: number | null;
  created_at: string;
  leadId: string | null;
};

export async function getCompanyDetail(companyId: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data: company, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (error) throw error;
  if (!company) return null;

  const { data: lead } = await supabase.from("leads").select("id").eq("company_id", companyId).maybeSingle();

  return { ...company, leadId: lead?.id ?? null };
}
