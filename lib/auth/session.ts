import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  /** Can open Admin and create users, set passwords and remove access. */
  canManageUsers: boolean;
};

/** Reads the signed-in user (if any) plus their team role, via the session-scoped client. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, can_manage_users")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? "rep",
    canManageUsers: profile?.can_manage_users ?? false,
  };
}
