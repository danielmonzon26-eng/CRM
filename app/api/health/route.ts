import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  try {
    const supabase = createAdminClient();
    // auth.getSession() with the service role client just confirms the client can
    // reach the Supabase project; no schema is required to exist yet at this step.
    const { error } = await supabase.auth.getSession();
    if (error) throw error;

    return NextResponse.json({ ok: true, supabase: "reachable" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
