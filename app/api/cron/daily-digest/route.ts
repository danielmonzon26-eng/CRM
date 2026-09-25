import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyDigest, renderDigestHtml } from "@/lib/notifications/digest";
import { sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Emails the team a summary of leads promoted in the last 24h, plus a pipeline
 * snapshot. Degrades gracefully without RESEND_API_KEY: still computes and returns
 * the digest, just doesn't send it -- useful for testing the query/content before
 * signing up for an email provider.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const digest = await buildDailyDigest(supabase, 1);

  if (digest.newLeads.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "No new leads in the last 24 hours" });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "RESEND_API_KEY not set -- digest computed but not emailed",
      newLeadsCount: digest.newLeads.length,
    });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("email")
    .not("email", "is", null);
  if (profilesError) {
    return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
  }

  const recipients = profiles.map((p) => p.email).filter((email): email is string => Boolean(email));
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "No team member emails on file" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const html = renderDigestHtml(digest, siteUrl);

  try {
    await sendEmail({
      to: recipients,
      subject: `${digest.newLeads.length} new lead${digest.newLeads.length === 1 ? "" : "s"} — Calgary Lead Engine`,
      html,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    recipients: recipients.length,
    newLeadsCount: digest.newLeads.length,
  });
}
