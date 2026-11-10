"use server";

import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_TOPICS } from "@/lib/events/feedback";

export type FeedbackInput = {
  token: string;
  satisfaction: number;
  recommend: number;
  topics: string[];
  mostValuable: string;
  improve: string;
  followUp: string | null;
  /** Hidden from people; anything here came from a bot. */
  website: string;
};

export async function submitFeedback(input: FeedbackInput): Promise<{ status: "ok" | "invalid" | "already" | "error" }> {
  if (input.website) return { status: "ok" };
  const topics = input.topics.filter((t) => FEEDBACK_TOPICS.some(([key]) => key === t));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_event_feedback", {
    p_token: input.token,
    p_satisfaction: input.satisfaction,
    p_recommend: input.recommend,
    p_topics: topics,
    p_most_valuable: input.mostValuable.slice(0, 5000) || null,
    p_improve: input.improve.slice(0, 5000) || null,
    p_follow_up: input.followUp,
  });
  if (error) {
    console.error("submit_event_feedback failed", error.message);
    return { status: "error" };
  }
  return { status: data };
}
