import { createClient } from "@/lib/supabase/server";
import type { ContactCard } from "@/components/contact-cards";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

export type ContactListRow = {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  leadId: string;
  companyId: string;
  companyName: string;
  status: LeadStatus;
  engagement: LeadEngagement;
  clientType: string | null;
};

export async function getContactsList(search?: string): Promise<ContactListRow[]> {
  const supabase = await createClient();

  let contactQuery = supabase
    .from("contacts")
    .select("id, full_name, title, email, phone, is_primary, lead_id")
    .order("full_name");
  if (search?.trim()) {
    const term = search.trim();
    contactQuery = contactQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const contacts = await fetchAllPages((from, to) => contactQuery.range(from, to));
  if (contacts.length === 0) return [];

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, company_id, status, engagement, client_type").range(from, to)
  );
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const companies = await fetchAllPages((from, to) => supabase.from("companies").select("id, name").range(from, to));
  const companyById = new Map(companies.map((c) => [c.id, c.name]));

  return contacts
    .map((c) => {
      const lead = leadById.get(c.lead_id);
      if (!lead) return null;
      return {
        id: c.id,
        fullName: c.full_name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isPrimary: c.is_primary,
        leadId: c.lead_id,
        companyId: lead.company_id,
        companyName: companyById.get(lead.company_id) ?? "Unknown company",
        status: lead.status,
        engagement: lead.engagement,
        clientType: lead.client_type,
      };
    })
    .filter((c): c is ContactListRow => c !== null);
}

/** Everyone at one company (its lead's contacts), primary first. */
export async function getContactsForLead(leadId: string): Promise<ContactCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, title, email, email_confidence, phone, linkedin_url, is_primary, lead_id")
    .eq("lead_id", leadId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map(toContactCard);
}

export function toContactCard(c: {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  email_confidence: number | null;
  phone: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  lead_id: string;
}): ContactCard {
  return {
    id: c.id,
    name: c.full_name,
    title: c.title,
    email: c.email,
    emailConfidence: c.email_confidence,
    phone: c.phone,
    linkedinUrl: c.linkedin_url,
    isPrimary: c.is_primary,
    leadId: c.lead_id,
  };
}
