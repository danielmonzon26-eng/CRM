import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { hunterDomainSearch } from "@/lib/enrichment/hunter";
import { rankHunterPeople } from "@/lib/enrichment/rank";
import { extractDomain } from "@/lib/text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 20;
const TERMINAL_STATUSES = new Set(["won", "lost", "unqualified"]);

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Finds decision-maker contacts (CEO/owner, business development, marketing, other
 * management — see lib/enrichment/rank.ts) for leads that don't have any yet, via
 * Hunter.io's Domain Search API. A lead with >=1 contact is considered enriched for
 * now; there's no staleness/refresh policy yet.
 *
 * NOTE: this is Hunter.io only. True open-web search (crawling LinkedIn, company
 * "About/Team" pages, etc.) needs a search API this project doesn't have credentials
 * for yet (Google Custom Search, Bing, SerpAPI, or similar) — see README for how to
 * wire one in as a second provider. Hunter alone covers companies with any indexed
 * email footprint; brand-new or very small businesses often won't have one yet.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.HUNTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "HUNTER_API_KEY not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const batchSize = Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_BATCH_SIZE);

  const leads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("id, company_id, status").range(from, to)
  );

  const enrichedLeadIds = new Set(
    (await fetchAllPages((from, to) => supabase.from("contacts").select("lead_id").range(from, to))).map(
      (c) => c.lead_id
    )
  );

  const candidateLeads = leads
    .filter((l) => !TERMINAL_STATUSES.has(l.status) && !enrichedLeadIds.has(l.id))
    .slice(0, batchSize);

  if (candidateLeads.length === 0) {
    return NextResponse.json({ ok: true, leadsProcessed: 0, message: "No leads pending enrichment" });
  }

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, domain, website")
    .in(
      "id",
      candidateLeads.map((l) => l.company_id)
    );
  if (companiesError) {
    return NextResponse.json({ ok: false, error: companiesError.message }, { status: 500 });
  }
  const companyById = new Map(companies.map((c) => [c.id, c]));

  let contactsCreated = 0;
  let leadsWithContacts = 0;
  let leadsWithoutContacts = 0;
  let errors = 0;

  for (const lead of candidateLeads) {
    const company = companyById.get(lead.company_id);
    if (!company) continue;

    try {
      const knownDomain = company.domain ?? extractDomain(company.website);
      const { domain: resolvedDomain, people } = await hunterDomainSearch(
        knownDomain ? { domain: knownDomain } : { company: company.name }
      );

      if (resolvedDomain && resolvedDomain !== company.domain) {
        await supabase
          .from("companies")
          .update({ domain: resolvedDomain, website: company.website ?? `https://${resolvedDomain}` })
          .eq("id", company.id);
      }

      const ranked = rankHunterPeople(people);

      if (ranked.length === 0) {
        leadsWithoutContacts++;
        await supabase.from("activities").insert({
          lead_id: lead.id,
          type: "enrichment_run",
          body: "No contacts found via Hunter.io",
        });
        continue;
      }

      for (const [index, person] of ranked.entries()) {
        const { error: insertError } = await supabase.from("contacts").insert({
          lead_id: lead.id,
          full_name: person.fullName,
          title: person.title,
          email: person.email,
          email_confidence: person.emailConfidence,
          phone: person.phone,
          linkedin_url: person.linkedinUrl,
          source: "hunter_io",
          is_primary: index === 0,
        });
        if (insertError) throw insertError;
        contactsCreated++;
      }

      leadsWithContacts++;
      await supabase.from("activities").insert({
        lead_id: lead.id,
        type: "enrichment_run",
        body: `Found ${ranked.length} contact(s) via Hunter.io`,
      });
    } catch (err) {
      errors++;
      await supabase.from("activities").insert({
        lead_id: lead.id,
        type: "enrichment_run",
        body: `Enrichment failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    leadsProcessed: candidateLeads.length,
    leadsWithContacts,
    leadsWithoutContacts,
    contactsCreated,
    errors,
  });
}
