"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
  if (!email.trim() || !password) return { error: "Email and password are required" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: error.message };
  return {};
}

export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  if (!email.trim()) return { error: "Email is required" };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  if (error) return { error: error.message };
  return {};
}
