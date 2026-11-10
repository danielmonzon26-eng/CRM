import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { scoreCompany, type LicenseForScoring } from "@/lib/leads/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Re-scores every company from its license history and:
 *  - never creates leads: a company only becomes a lead when someone makes it one
 *  - refreshes score/score_reasons on leads that already exist, WITHOUT touching their
 *    status — a rep's manual pipeline progress is never reset by re-scoring...
 *  - ...EXCEPT when a company is now hard-disqualified (sub-$2M revenue recorded on
 *    it, see scoring.ts) and its existing lead is still marked Engaged and isn't a client —
 *    those get their status set to Not Qualified, logged as an activity. Clients and
 *    Do Not Contact leads are never changed.
 *
 * Safe to run repeatedly (e.g. after ingestion, or after editing TARGET_INDUSTRIES).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const companies = await fetchAllPages((from, to) =>
    supabase.from("companies").select("id, industry, estimated_annual_revenue").range(from, to)
  );

  const licenseRows = await fetchAllPages((from, to) =>
    supabase
      .from("licenses")
      .select("company_id, issue_date, license_status, license_type, is_home_based")
      .not("company_id", "is", null)
      .range(from, to)
  );

  const licensesByCompany = new Map<string, LicenseForScoring[]>();
  for (const row of licenseRows) {
    if (!row.company_id) continue;
    const list = licensesByCompany.get(row.company_id) ?? [];
    list.push({
      issue_date: row.issue_date,
      license_status: row.license_status,
      license_type: row.license_type,
      is_home_based: row.is_home_based,
    });
    licensesByCompany.set(row.company_id, list);
  }

  let rescored = 0;
  let autoDisqualified = 0;
  let skipped = 0;

  for (const company of companies) {
    const licenses = licensesByCompany.get(company.id) ?? [];
    const { score, reasons, disqualified } = scoreCompany(
      licenses,
      company.industry,
      company.estimated_annual_revenue
    );

    const { data: existingLead, error: findError } = await supabase
      .from("leads")
      .select("id, status, engagement")
      .eq("company_id", company.id)
      .maybeSingle();
    if (findError) throw findError;

    if (existingLead) {
      const shouldAutoUnqualify =
        disqualified && existingLead.engagement === "engaged" && existingLead.status !== "client";

      const updates: { score: number; score_reasons: typeof reasons; engagement?: "not_qualified" } = {
        score,
        score_reasons: reasons,
      };
      if (shouldAutoUnqualify) updates.engagement = "not_qualified";

      const { error: updateError } = await supabase.from("leads").update(updates).eq("id", existingLead.id);
      if (updateError) throw updateError;

      if (shouldAutoUnqualify) {
        await supabase.from("activities").insert({
          lead_id: existingLead.id,
          type: "status_change",
          body: "Status set to Not Qualified: estimated annual revenue is below the $2M+ target",
          metadata: { reasons },
        });
        autoDisqualified++;
      }
      rescored++;
      continue;
    }

    // Leads are only made by people, so companies that aren't leads are just scored.
    skipped++;
  }

  return NextResponse.json({
    ok: true,
    companiesEvaluated: companies.length,
    rescored,
    autoDisqualified,
    skipped,
  });
}
