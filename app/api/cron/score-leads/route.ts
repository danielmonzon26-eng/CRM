import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { MIN_SCORE_TO_QUALIFY, scoreCompany, type LicenseForScoring } from "@/lib/leads/scoring";
import type { LeadStatus } from "@/lib/supabase/types";

// Statuses a rep has already closed out manually -- re-scoring (including an
// auto-disqualification) never overwrites these.
const TERMINAL_STATUSES: LeadStatus[] = ["won", "lost"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Re-scores every company from its license history and:
 *  - creates a `leads` row (status "new") for any company crossing MIN_SCORE_TO_QUALIFY
 *    that isn't already a lead, logging an activity for it
 *  - refreshes score/score_reasons on leads that already exist, WITHOUT touching their
 *    status — a rep's manual pipeline progress is never reset by re-scoring...
 *  - ...EXCEPT when a company is now hard-disqualified (sub-$2M revenue recorded on
 *    it, see scoring.ts) and its existing lead isn't already "won" or "lost" — those
 *    get auto-moved to "unqualified", logged as an activity, since a rep's already-
 *    closed decision should never be silently reopened or relabeled.
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
      .select("company_id, issue_date, license_status, license_type")
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
    });
    licensesByCompany.set(row.company_id, list);
  }

  let promoted = 0;
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
      .select("id, status")
      .eq("company_id", company.id)
      .maybeSingle();
    if (findError) throw findError;

    if (existingLead) {
      const shouldAutoUnqualify =
        disqualified &&
        existingLead.status !== "unqualified" &&
        !TERMINAL_STATUSES.includes(existingLead.status);

      const updates: { score: number; score_reasons: typeof reasons; status?: LeadStatus } = {
        score,
        score_reasons: reasons,
      };
      if (shouldAutoUnqualify) updates.status = "unqualified";

      const { error: updateError } = await supabase.from("leads").update(updates).eq("id", existingLead.id);
      if (updateError) throw updateError;

      if (shouldAutoUnqualify) {
        await supabase.from("activities").insert({
          lead_id: existingLead.id,
          type: "status_change",
          body: "Auto-moved to \"unqualified\": estimated annual revenue is below the $2M+ target",
          metadata: { reasons },
        });
        autoDisqualified++;
      }
      rescored++;
      continue;
    }

    if (score < MIN_SCORE_TO_QUALIFY) {
      skipped++;
      continue;
    }

    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({ company_id: company.id, status: "new", score, score_reasons: reasons })
      .select("id")
      .single();
    if (insertError) throw insertError;

    await supabase.from("activities").insert({
      lead_id: newLead.id,
      type: "status_change",
      body: `Auto-qualified as a lead (score ${score}/100)`,
      metadata: { reasons },
    });
    promoted++;
  }

  return NextResponse.json({
    ok: true,
    companiesEvaluated: companies.length,
    promoted,
    rescored,
    autoDisqualified,
    skipped,
    minScoreToQualify: MIN_SCORE_TO_QUALIFY,
  });
}
