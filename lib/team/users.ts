import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export type UserStatus = "active" | "invited" | "removed" | "unknown";

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  status: UserStatus;
  lastSignInAt: string | null;
};

/** Adding and removing accounts needs the server-only key, which local copies of the app don't have. */
export function canManageAccounts(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function userStatus(account: { banned_until?: string | null; last_sign_in_at?: string | null }, now = Date.now()): UserStatus {
  if (account.banned_until && new Date(account.banned_until).getTime() > now) return "removed";
  return account.last_sign_in_at ? "active" : "invited";
}

/** Every profile, plus sign-in details from Supabase Auth when the server key is available. */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase.from("profiles").select("id, email, full_name, role").order("email");
  if (error) throw error;

  const accounts = new Map<string, { banned_until?: string | null; last_sign_in_at?: string | null }>();
  if (canManageAccounts()) {
    const { data, error: listError } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    for (const account of data.users) accounts.set(account.id, account);
  }

  return profiles.map((profile) => {
    const account = accounts.get(profile.id);
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      status: account ? userStatus(account) : "unknown",
      lastSignInAt: account?.last_sign_in_at ?? null,
    };
  });
}
