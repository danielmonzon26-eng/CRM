import { parseQuestions, type RegistrationQuestion } from "@/lib/events/questions";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A public event's registration questions, read on the server (visitors aren't signed in,
 * and the public event function doesn't return them). Only published events answer.
 */
export async function getRegistrationQuestions(slug: string): Promise<RegistrationQuestion[]> {
  const { data, error } = await createAdminClient()
    .from("events")
    .select("registration_questions")
    .eq("slug", slug)
    .eq("status", "published")
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    console.error("Loading registration questions failed:", error.message);
    return [];
  }
  return parseQuestions(data?.registration_questions);
}
