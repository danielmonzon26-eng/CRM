import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMPTY = { events: [], companies: [], contacts: [] };

export async function GET(request: Request) {
  const q = new URL(request.url)
    .searchParams.get("q")
    ?.trim()
    // These characters have meaning in the database's filter syntax.
    .replace(/[,()%*\\]/g, " ")
    .trim();
  if (!q || q.length < 2) return NextResponse.json(EMPTY);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(EMPTY, { status: 401 });

  const [{ data: events }, { data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("events").select("id, title, program").is("archived_at", null).ilike("title", `%${q}%`).limit(5),
    supabase.from("companies").select("id, name, community").ilike("name", `%${q}%`).limit(8),
    supabase
      .from("contacts")
      .select("id, full_name, email, lead_id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8),
  ]);

  return NextResponse.json({ events: events ?? [], companies: companies ?? [], contacts: contacts ?? [] });
}
