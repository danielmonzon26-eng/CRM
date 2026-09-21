"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  if (!email.trim()) return { error: "Email is required" };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) return { error: error.message };
  return {};
}
