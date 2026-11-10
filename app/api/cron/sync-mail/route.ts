import { NextRequest, NextResponse } from "next/server";
import { isOutlookConfigured } from "@/lib/outlook/graph";
import { syncAccounts } from "@/lib/outlook/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily catch-up of every connected Outlook mailbox. Pages that show email also sync
 * in the background when opened, since the Hobby plan only allows daily cron jobs.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isOutlookConfigured()) {
    return NextResponse.json({ ok: true, synced: [], reason: "Outlook is not configured" });
  }

  const results = await syncAccounts(createAdminClient());
  return NextResponse.json({ ok: results.every((r) => !r.error), synced: results });
}
