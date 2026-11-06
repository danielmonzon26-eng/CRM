"use server";

import { createClient } from "@/lib/supabase/server";

const INVALID_LINK = "This link has expired or was already used. Ask an admin for a new one.";

/**
 * The link is only used up here, when the form is submitted, so chat and email apps that
 * preview a link can't spend it before the person opens it.
 */
export async function acceptInvite(
  tokenHash: string,
  type: string,
  password: string
): Promise<{ error?: string; verified?: boolean }> {
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (type !== "invite" && type !== "recovery") return { error: INVALID_LINK };

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (verifyError) return { error: INVALID_LINK };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message, verified: true };
  return { verified: true };
}
