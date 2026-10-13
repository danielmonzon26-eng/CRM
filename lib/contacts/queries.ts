import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { LeadStatus } from "@/lib/supabase/types";

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
    supabase.from("leads").select("id, company_id, status").range(from, to)
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
      };
    })
    .filter((c): c is ContactListRow => c !== null);
}
