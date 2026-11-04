import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";

/** Every company with what's known about its business. Contact emails are reduced to their domains. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const [companies, licenses, leads, contacts] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("companies").select("id, name, website, domain, community, industry").order("name").range(from, to)),
    fetchAllPages((from, to) => supabase.from("licenses").select("company_id, license_type, description").not("company_id", "is", null).range(from, to)),
    fetchAllPages((from, to) => supabase.from("leads").select("id, company_id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("contacts").select("lead_id, email, title").range(from, to)),
  ]);

  const companyByLead = new Map(leads.map((l) => [l.id, l.company_id]));
  const collect = (map: Map<string, Set<string>>, key: string | null | undefined, value: string | null | undefined) => {
    if (!key || !value) return;
    map.set(key, (map.get(key) ?? new Set()).add(value));
  };
  const licenseText = new Map<string, Set<string>>();
  const emailDomains = new Map<string, Set<string>>();
  const titles = new Map<string, Set<string>>();
  for (const l of licenses) {
    collect(licenseText, l.company_id, l.license_type);
    collect(licenseText, l.company_id, l.description);
  }
  for (const c of contacts) {
    const companyId = companyByLead.get(c.lead_id);
    collect(emailDomains, companyId, c.email?.split("@")[1]?.toLowerCase());
    collect(titles, companyId, c.title);
  }
  const joined = (map: Map<string, Set<string>>, id: string) => [...(map.get(id) ?? [])].join("; ");

  const rows = [
    ["Company ID", "Name", "Website", "Domain", "Community", "Current industry", "License details", "Contact email domains", "Contact titles"],
    ...companies.map((c) => [c.id, c.name, c.website, c.domain, c.community, c.industry, joined(licenseText, c.id), joined(emailDomains, c.id), joined(titles, c.id)]),
  ];

  return new Response(rows.map((row) => row.map(csvCell).join(",")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="companies.csv"',
      "Cache-Control": "no-store",
    },
  });
}
