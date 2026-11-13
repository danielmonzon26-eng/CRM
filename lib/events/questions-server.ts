import { parseQuestions, type RegistrationQuestion } from "@/lib/events/questions";
import { createClient } from "@/lib/supabase/server";

/** A published event's registration questions, for the public page (no sign-in needed). */
export async function getRegistrationQuestions(slug: string): Promise<RegistrationQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_registration_questions", { p_slug: slug });
  if (error) {
    console.error("Loading registration questions failed:", error.message);
    return [];
  }
  return parseQuestions(data);
}
