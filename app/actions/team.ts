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
  // Only account managers (Steve and Dan) manage accounts.
  return user?.canManageUsers ? user : null;
}

const NOT_MANAGER = "Only account managers can do this.";

/**
 * Profile edits from Admin. The database only lets the old "admin" role edit profiles, and
 * account managers may not have it, so use the server key once the caller has been checked.
 * Without the key (local), fall back to the signed-in user's own access.
 */
async function profilesWriter() {
  return canManageAccounts() ? createAdminClient() : await createClient();
}
const MIN_PASSWORD = 8;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for the password.`;
  if (password.length > 72) return "Keep the password under 72 characters.";
  return null;
}

async function acceptLink(tokenHash: string, type: "invite" | "recovery"): Promise<string> {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  return `${await getSiteUrl()}/auth/accept?${params}`;
}

/**
 * Creates the account with admin access. With a password, they can sign in straight away;
 * without one, this returns a one-time link for them to set their own.
 */
export async function addUser(input: { firstName: string; lastName: string; email: string; password?: string }): Promise<LinkResult & { created?: boolean }> {
  if (!(await requireAdmin())) return { error: NOT_MANAGER };
  if (!canManageAccounts()) return { error: NO_KEY };

  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const name = `${first} ${last}`.trim().replace(/\s+/g, " ");
  const address = input.email.trim().toLowerCase();
  const password = input.password ?? "";
  if (!first || !last) return { error: "Enter their first and last name." };
  if (!EMAIL_PATTERN.test(address)) return { error: "Enter a valid email address." };

  const admin = createAdminClient();

  if (password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
    const { data, error } = await admin.auth.admin.createUser({ email: address, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) {
      return { error: error?.code === "email_exists" ? "That email already has an account." : "That user wasn't added. Please try again." };
    }
    const { error: profileError } = await admin.from("profiles").update({ role: "admin", full_name: name }).eq("id", data.user.id);
    revalidatePath("/admin");
    if (profileError) return { error: "The account was created, but it doesn't have admin access yet. Use Give admin access on the list." };
    return { created: true };
  }

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
  if (!(await requireAdmin())) return { error: NOT_MANAGER };
  if (!canManageAccounts()) return { error: NO_KEY };

  const admin = createAdminClient();
  const { data: account, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !account.user.email) return { error: "That user wasn't found." };

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: account.user.email });
  if (error) return { error: "The link wasn't created. Please try again." };
  return { link: await acceptLink(data.properties.hashed_token, "recovery") };
}

export async function giveAdminAccess(userId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: NOT_MANAGER };

  const { data, error } = await (await profilesWriter()).from("profiles").update({ role: "admin" }).eq("id", userId).select("id");
  if (error || !data?.length) return { error: "Admin access wasn't given. Please try again." };
  revalidatePath("/admin");
  return {};
}

/** Blocks or restores sign-in. Accounts aren't deleted, so their leads, deals and history stay intact. */
export async function setUserAccess(userId: string, hasAccess: boolean): Promise<ActionResult> {
  const currentUser = await requireAdmin();
  if (!currentUser) return { error: NOT_MANAGER };
  if (!canManageAccounts()) return { error: NO_KEY };
  if (userId === currentUser.id) return { error: "You can't remove your own access." };

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: hasAccess ? "none" : FOREVER });
  if (error) return { error: "That change wasn't saved. Please try again." };
  revalidatePath("/admin");
  return {};
}

/** Sets a team member's full name, shown wherever people are listed or assigned. */
export async function setUserName(userId: string, fullName: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: NOT_MANAGER };
  const name = fullName.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Enter their first and last name." };
  if (name.length > 120) return { error: "Keep the name under 120 characters." };
  const { data, error } = await (await profilesWriter()).from("profiles").update({ full_name: name }).eq("id", userId).select("id");
  if (error || !data?.length) return { error: "The name wasn't saved. Please try again." };
  revalidatePath("/", "layout");
  return {};
}

/** Sets a new password for someone, so they can sign in with it straight away. */
export async function setUserPassword(userId: string, password: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: NOT_MANAGER };
  if (!canManageAccounts()) return { error: NO_KEY };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { error: "The password wasn't changed. Please try again." };
  return {};
}
