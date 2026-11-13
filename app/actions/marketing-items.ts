"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isDeliveryTiming, isMarketingCategory, isMarketingStatus, isMarketingStream } from "@/lib/budgets/marketing-items";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FAILED = "That didn't save. Please try again.";

export type MarketingItemInput = {
  id: string | null;
  stream: string;
  type: string;
  description: string;
  eventId: string | null;
  sponsorId: string | null;
  amount: string;
  budgetLineId: string | null;
  timing: string | null;
  deliveryOn: string | null;
  status: string;
};

function revalidate(eventId?: string | null) {
  revalidatePath("/marketing", "layout");
  revalidatePath("/budgets", "layout");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

/** Creates or updates a marketing item; its budget cost follows in the database. */
export async function saveMarketingItem(input: MarketingItemInput): Promise<{ error?: string; id?: string }> {
  if (!(await getCurrentUser())) return { error: "Sign in first." };
  if (!isMarketingStream(input.stream)) return { error: "Choose Catapult, Event or Sponsorship." };
  if (!isMarketingCategory(input.type)) return { error: "Choose the item: Social, Online Advertising, Production or Creative." };
  if (!isMarketingStatus(input.status)) return { error: "Choose a status." };
  for (const id of [input.id, input.eventId, input.sponsorId, input.budgetLineId]) if (id && !UUID.test(id)) return { error: "Choose from the lists." };
  if (input.stream === "event" && !input.eventId) return { error: "Choose the event." };
  if (input.stream === "sponsorship" && !input.sponsorId) return { error: "Choose the sponsor." };
  // Everything is paid from somewhere, so budgets always show what's allocated.
  if (!input.budgetLineId) return { error: "Choose the budget line that pays for it." };
  const timing = input.timing || null;
  if (timing && !isDeliveryTiming(timing)) return { error: "Choose when it's due." };
  // Without an event, there's nothing to count back from: only a date works.
  if (timing && timing !== "custom" && !input.eventId) return { error: "Pick a date: \"before the event\" needs an event." };
  if (timing === "custom" && !(input.deliveryOn && DAY.test(input.deliveryOn))) return { error: "Pick the due date." };
  const amount = input.amount.trim() === "" ? 0 : Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the amount in dollars, or leave it blank." };

  const values = {
    stream: input.stream,
    item_type: input.type,
    description: input.description.trim().slice(0, 200),
    event_id: input.stream === "catapult" ? null : input.eventId,
    sponsor_company_id: input.stream === "sponsorship" ? input.sponsorId : null,
    amount: Math.round(amount * 100) / 100,
    budget_line_id: input.budgetLineId,
    delivery_timing: timing,
    delivery_on: timing === "custom" ? input.deliveryOn : null,
    status: input.status,
  };
  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("marketing_items").update(values).eq("id", input.id);
    if (error) return { error: FAILED };
    revalidate(values.event_id);
    return { id: input.id };
  }
  const { data, error } = await supabase.from("marketing_items").insert(values).select("id").single();
  if (error || !data) return { error: FAILED };
  revalidate(values.event_id);
  return { id: data.id };
}

export async function deleteMarketingItem(id: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Sign in first." };
  if (!UUID.test(id)) return { error: "That item wasn't found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("marketing_items").delete().eq("id", id).select("event_id");
  if (error) return { error: "That wasn't deleted. Please try again." };
  revalidate(data?.[0]?.event_id);
  return {};
}

/** Sponsor companies for the Sponsorship dropdown, searched by name. */
export async function searchSponsors(query: string): Promise<{ id: string; name: string }[]> {
  if (!(await getCurrentUser())) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id, name").ilike("name", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`).order("name").limit(12);
  return data ?? [];
}
