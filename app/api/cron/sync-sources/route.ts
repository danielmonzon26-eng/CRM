import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { SOURCE_ADAPTERS } from "@/lib/sources/registry";
import type { SourceAdapter } from "@/lib/sources/types";
import { matchOrCreateCompany } from "@/lib/leads/matching";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_WINDOW_DAYS = 7;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Runs every adapter in lib/sources/registry.ts against records issued/listed in the
 * last `days` (default 7), upserting into `licenses` and matching/creating
 * `companies` — the same pipeline Step 3 built for Calgary alone, now source-agnostic.
 *
 * Query params: `?days=N` widens/narrows the window; `?source=<key>` runs just one
 * adapter (useful when testing a new one without re-running everything else).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const windowDays = Number(request.nextUrl.searchParams.get("days") ?? DEFAULT_WINDOW_DAYS);
  const onlySourceKey = request.nextUrl.searchParams.get("source");
  const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const adapters = onlySourceKey
    ? SOURCE_ADAPTERS.filter((a) => a.key === onlySourceKey)
    : SOURCE_ADAPTERS;

  if (adapters.length === 0) {
    return NextResponse.json(
      { ok: false, error: onlySourceKey ? `No adapter registered with key '${onlySourceKey}'` : "No adapters registered" },
      { status: 400 }
    );
  }

  const results = [];
  for (const adapter of adapters) {
    results.push(await runAdapter(supabase, adapter, sinceDate));
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), sinceDate, results });
}

async function runAdapter(supabase: SupabaseClient<Database>, adapter: SourceAdapter, sinceDate: string) {
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .upsert({ key: adapter.key, name: adapter.name, kind: adapter.kind }, { onConflict: "key" })
    .select("id")
    .single();

  if (sourceError) {
    return { source: adapter.key, ok: false, error: sourceError.message };
  }

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ source_id: source.id, status: "running" })
    .select("id")
    .single();
  if (runError || !run) {
    return { source: adapter.key, ok: false, error: runError?.message };
  }

  try {
    const { records, truncated } = await adapter.fetchSince(sinceDate);

    let recordsNew = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    for (const record of records) {
      if (!record.externalId || !record.businessName) {
        recordsSkipped++;
        continue;
      }

      const { data: existingLicense, error: existingError } = await supabase
        .from("licenses")
        .select("id")
        .eq("source_id", source.id)
        .eq("external_id", record.externalId)
        .maybeSingle();
      if (existingError) throw existingError;

      const companyId = await matchOrCreateCompany(supabase, record);

      const { error: upsertError } = await supabase.from("licenses").upsert(
        {
          source_id: source.id,
          company_id: companyId,
          external_id: record.externalId,
          business_name: record.businessName,
          license_type: record.licenseType,
          license_status: record.status,
          issue_date: record.issueDate,
          address: record.address,
          community: record.community,
          is_home_based: record.isHomeBased,
          raw: record.raw,
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

    return {
      source: adapter.key,
      ok: true,
      recordsFetched: records.length,
      recordsNew,
      recordsUpdated,
      recordsSkipped,
      truncated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("sync_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.id);

    return { source: adapter.key, ok: false, error: message };
  }
}
