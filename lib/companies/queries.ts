import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

export type CompanyListRow = {
  id: string;
  name: string;
  community: string | null;
  industry: string | null;
  estimatedAnnualRevenue: number | null;
  leadId: string | null;
  status: LeadStatus | null;
  engagement: LeadEngagement | null;
  score: number | null;
  contactCount: number;
  clientType: string | null;
  programs: string[];
  /** Lowercase text the keyword search looks through: the company and its contacts. */
  searchText: string;
};

export async function getCompaniesList(): Promise<CompanyListRow[]> {
  const supabase = await createClient();

  const companies = await fetchAllPages((from, to) =>
    supabase.from("companies").select("id, name, community, industry, website, phone, address_line, estimated_annual_revenue").order("name").range(from, to)
  );
  if (companies.length === 0) return [];

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, company_id, status, engagement, score, client_type, programs").range(from, to)
  );
  const leadByCompany = new Map(leads.map((l) => [l.company_id, l]));

  const contacts = await fetchAllPages((from, to) =>
    supabase.from("contacts").select("lead_id, full_name, title, email").range(from, to)
  );
  const contactCounts = new Map<string, number>();
  const contactText = new Map<string, string[]>();
  for (const c of contacts) {
    contactCounts.set(c.lead_id, (contactCounts.get(c.lead_id) ?? 0) + 1);
    contactText.set(c.lead_id, [...(contactText.get(c.lead_id) ?? []), c.full_name, c.title ?? "", c.email ?? ""]);
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
      engagement: lead?.engagement ?? null,
      score: lead?.score ?? null,
      contactCount: lead ? contactCounts.get(lead.id) ?? 0 : 0,
      clientType: lead?.client_type ?? null,
      programs: lead?.programs ?? [],
      searchText: [c.name, c.community, c.industry, c.website, c.phone, c.address_line, ...(lead ? contactText.get(lead.id) ?? [] : [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
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
  lead: { id: string; status: LeadStatus; engagement: LeadEngagement; clientType: string | null; programs: string[] } | null;
};

export async function getCompanyDetail(companyId: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data: company, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (error) throw error;
  if (!company) return null;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, status, engagement, client_type, programs")
    .eq("company_id", companyId)
    .maybeSingle();

  return {
    ...company,
    leadId: lead?.id ?? null,
    lead: lead
      ? { id: lead.id, status: lead.status, engagement: lead.engagement, clientType: lead.client_type, programs: lead.programs }
      : null,
  };
}
