import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCalgaryLicensesSince, mapCalgaryRecord } from "@/lib/sources/calgary";
import { matchOrCreateCompany } from "@/lib/leads/matching";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE_KEY = "calgary_business_licenses";
const DEFAULT_WINDOW_DAYS = 7;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Pulls Calgary business licences issued in the last `days` (default 7 — wider than
 * "since yesterday" so a missed or delayed run still catches up), upserts them into
 * `licenses`, and matches/creates the corresponding `companies` row for each.
 *
 * Query params: `?days=N` to widen/narrow the window (also doubles as the manual
 * backfill mechanism — e.g. `?days=3650` for a first historical load, though see
 * MAX_PAGES_PER_CALL in lib/sources/calgary.ts for the per-invocation cap).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id")
    .eq("key", SOURCE_KEY)
    .single();

  if (sourceError || !source) {
    return NextResponse.json(
      {
        ok: false,
        error: `Source '${SOURCE_KEY}' not found — has the schema migration (supabase/migrations) been applied?`,
      },
      { status: 500 }
    );
  }

  const windowDays = Number(request.nextUrl.searchParams.get("days") ?? DEFAULT_WINDOW_DAYS);
  const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ source_id: source.id, status: "running" })
    .select("id")
    .single();

  if (runError || !run) {
    return NextResponse.json({ ok: false, error: runError?.message }, { status: 500 });
  }

  try {
    const { records, truncated } = await fetchCalgaryLicensesSince(sinceDate);

    let recordsNew = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    for (const raw of records) {
      const mapped = mapCalgaryRecord(raw);
      if (!mapped) {
        recordsSkipped++;
        continue;
      }

      const { data: existingLicense, error: existingError } = await supabase
        .from("licenses")
        .select("id")
        .eq("source_id", source.id)
        .eq("external_id", mapped.externalId)
        .maybeSingle();
      if (existingError) throw existingError;

      const companyId = await matchOrCreateCompany(supabase, mapped);

      const { error: upsertError } = await supabase.from("licenses").upsert(
        {
          source_id: source.id,
          company_id: companyId,
          external_id: mapped.externalId,
          business_name: mapped.businessName,
          license_type: mapped.licenseType,
          license_status: mapped.status,
          issue_date: mapped.issueDate,
          address: mapped.address,
          community: mapped.community,
          raw: mapped.raw,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "source_id,external_id" }
      );
      if (upsertError) throw upsertError;

      if (existingLicense) recordsUpdated++;
      else recordsNew++;
    }

    await supabase
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        records_fetched: records.length,
        records_new: recordsNew,
        records_updated: recordsUpdated,
      })
      .eq("id", run.id);

    await supabase.from("sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source.id);

    return NextResponse.json({
      ok: true,
      sinceDate,
      recordsFetched: records.length,
      recordsNew,
      recordsUpdated,
      recordsSkipped,
      truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("sync_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.id);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
