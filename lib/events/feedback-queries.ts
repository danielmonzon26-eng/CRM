import { createClient } from "@/lib/supabase/server";
import { summarizeFeedback, type FeedbackSummary } from "./feedback";

const submittedFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Edmonton" });

/** Every feedback request and response for an event, summarized for the Feedback tab. */
export async function getEventFeedback(eventId: string): Promise<FeedbackSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_feedback").select("*").eq("event_id", eventId);
  if (error) throw error;

  const registrationIds = data.map((r) => r.registration_id).filter((id): id is string => Boolean(id));
  const { data: registrations } = registrationIds.length
    ? await supabase.from("event_registrations").select("id, lead_id").in("id", registrationIds)
    : { data: [] };
  const leadByRegistration = new Map((registrations ?? []).map((r) => [r.id, r.lead_id]));

  return summarizeFeedback(
    data.map((r) => ({
      id: r.id,
      requestSentAt: r.request_sent_at,
      sendError: r.send_error,
      response:
        r.submitted_at && r.satisfaction && r.recommend
          ? {
              id: r.id,
              name: r.full_name,
              email: r.email,
              satisfaction: r.satisfaction,
              recommend: r.recommend,
              topics: r.topics,
              mostValuable: r.most_valuable,
              improve: r.improve,
              followUp: r.follow_up,
              submittedAt: r.submitted_at,
              submittedLabel: submittedFormat.format(new Date(r.submitted_at)),
              leadId: r.registration_id ? leadByRegistration.get(r.registration_id) ?? null : null,
            }
          : null,
    }))
  );
}
