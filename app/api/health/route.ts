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

  const supabase = createAdminClient();

  const { error: authError } = await supabase.auth.getSession();
  if (authError) {
    return NextResponse.json(
      { ok: false, error: `Supabase unreachable: ${authError.message}` },
      { status: 500 }
    );
  }

  const { count, error: schemaError } = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true });

  if (schemaError) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "reachable",
        schema: "not applied",
        error: `Run supabase/migrations against this project: ${schemaError.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, supabase: "reachable", schema: "applied", sources: count });
}
