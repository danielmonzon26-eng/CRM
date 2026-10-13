import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ companies: [], contacts: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ companies: [], contacts: [] }, { status: 401 });

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("id, name, community").ilike("name", `%${q}%`).limit(8),
    supabase
      .from("contacts")
      .select("id, full_name, email, lead_id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8),
  ]);

  return NextResponse.json({ companies: companies ?? [], contacts: contacts ?? [] });
}
