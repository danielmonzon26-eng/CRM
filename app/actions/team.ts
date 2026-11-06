"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { canManageAccounts } from "@/lib/team/users";

const FOREVER = "876000h";
const NO_KEY = "Adding and removing users only works on the live site, where the server key is set.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionResult = { error?: string };
type LinkResult = ActionResult & { link?: string };

/**
 * The server key bypasses RLS, so these actions must check the caller themselves. New accounts
 * stay "rep" until an admin acts, because Supabase can also create accounts through public sign-up.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

async function acceptLink(tokenHash: string, type: "invite" | "recovery"): Promise<string> {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  return `${await getSiteUrl()}/auth/accept?${params}`;
}

/** Creates the account with admin access and returns a one-time link for them to set a password. */
export async function addUser(fullName: string, email: string): Promise<LinkResult> {
  if (!(await requireAdmin())) return { error: "Only admins can add users." };
  if (!canManageAccounts()) return { error: NO_KEY };

  const name = fullName.trim();
  const address = email.trim().toLowerCase();
  if (!name) return { error: "Enter their name." };
  if (!EMAIL_PATTERN.test(address)) return { error: "Enter a valid email address." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: address,
    options: { data: { full_name: name } },
  });
  if (error) {
    return { error: error.code === "email_exists" ? "That email already has an account." : "That user wasn't added. Please try again." };
  }

  const { error: profileError } = await admin.from("profiles").update({ role: "admin", full_name: name }).eq("id", data.user.id);
  revalidatePath("/admin");
  if (profileError) return { error: "The account was created, but it doesn't have admin access yet. Use Give admin access on the list." };

  return { link: await acceptLink(data.properties.hashed_token, "invite") };
}

/** Replaces an expired invite, or lets someone reset a password without email. */
export async function createUserLink(userId: string): Promise<LinkResult> {
  if (!(await requireAdmin())) return { error: "Only admins can do this." };
  if (!canManageAccounts()) return { error: NO_KEY };

  const admin = createAdminClient();
  const { data: account, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !account.user.email) return { error: "That user wasn't found." };

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: account.user.email });
  if (error) return { error: "The link wasn't created. Please try again." };
  return { link: await acceptLink(data.properties.hashed_token, "recovery") };
}

export async function giveAdminAccess(userId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Only admins can do this." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (error) return { error: "Admin access wasn't given. Please try again." };
  revalidatePath("/admin");
  return {};
}

/** Blocks or restores sign-in. Accounts aren't deleted, so their leads, deals and history stay intact. */
export async function setUserAccess(userId: string, hasAccess: boolean): Promise<ActionResult> {
  const currentUser = await requireAdmin();
  if (!currentUser) return { error: "Only admins can do this." };
  if (!canManageAccounts()) return { error: NO_KEY };
  if (userId === currentUser.id) return { error: "You can't remove your own access." };

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: hasAccess ? "none" : FOREVER });
  if (error) return { error: "That change wasn't saved. Please try again." };
  revalidatePath("/admin");
  return {};
}
