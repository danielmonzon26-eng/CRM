"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

/**
 * No admin check here beyond what RLS already enforces (see
 * "profiles updatable by admins" in supabase/migrations/0003_auth_profiles.sql) — a
 * non-admin calling this simply gets zero rows updated, not an error, since RLS makes
 * the row invisible to the update rather than raising.
 */
export async function updateUserRole(profileId: string, role: UserRole) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) throw error;

  revalidatePath("/team");
}
