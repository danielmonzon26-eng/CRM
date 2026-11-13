"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { fromDateTimeInput } from "@/lib/events/format";
import { isPlatform, readinessIssues } from "@/lib/marketing/constants";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";

type Result = { error?: string; id?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAVE_FAILED = "That didn't save. Please try again.";

function revalidate() {
  revalidatePath("/marketing", "layout");
  revalidatePath("/", "layout");
}

export type PostInput = {
  id: string | null;
  title: string;
  caption: string;
  initiativeId: string | null;
  /** datetime-local value in Calgary time, or "" for not scheduled yet. */
  scheduledAt: string;
  channelIds: string[];
  /** The uploaded image; null removes it; undefined leaves it as it is. */
  image?: { path: string; name: string } | null;
  /** save keeps the current status (new posts start as Requested). */
  intent: "save" | "submit" | "approve";
};

async function platformsFor(supabase: Awaited<ReturnType<typeof createClient>>, channelIds: string[]): Promise<SocialPlatform[] | null> {
  if (channelIds.length === 0) return [];
  const { data, error } = await supabase.from("marketing_channels").select("id, platform").in("id", channelIds);
  if (error || !data || data.length !== new Set(channelIds).size) return null;
  return data.map((c) => c.platform).filter(isPlatform);
}

export async function savePost(input: PostInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const isAdmin = user.role === "admin";

  const title = input.title.trim();
  const caption = input.caption.replace(/\r\n/g, "\n");
  if (!title) return { error: "Give the post a short title, so the team can find it." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (input.id && !UUID.test(input.id)) return { error: "That post wasn't found." };
  if (input.initiativeId && !UUID.test(input.initiativeId)) return { error: "Choose an initiative from the list." };
  const channelIds = [...new Set(input.channelIds)];
  if (channelIds.some((c) => !UUID.test(c))) return { error: "Choose channels from the list." };
  if (input.image && (!input.image.path.startsWith("posts/") || input.image.path.includes(".."))) return { error: "That image upload wasn't recognised. Please add it again." };
  if (input.intent === "approve" && !isAdmin) return { error: "Only an admin can approve posts." };

  let scheduledAt: string | null = null;
  if (input.scheduledAt) {
    try {
      scheduledAt = fromDateTimeInput(input.scheduledAt);
    } catch {
      return { error: "Check the date and time." };
    }
  }

  const supabase = await createClient();
  const platforms = await platformsFor(supabase, channelIds);
  if (platforms === null) return { error: "One of those channels no longer exists. Refresh and try again." };

  let existing: { status: SocialPostStatus; image_path: string | null } | null = null;
  let existingChannels: string[] = [];
  if (input.id) {
    const [{ data, error }, { data: links, error: linksError }] = await Promise.all([
      supabase.from("social_posts").select("status, image_path").eq("id", input.id).maybeSingle(),
      supabase.from("social_post_channels").select("channel_id").eq("post_id", input.id),
    ]);
    if (error || linksError) return { error: SAVE_FAILED };
    if (!data) return { error: "That post wasn't found. It may have been deleted." };
    existing = data;
    existingChannels = (links ?? []).map((l) => l.channel_id);
  }

  const imagePath = input.image === undefined ? existing?.image_path ?? null : input.image?.path ?? null;
  if (input.intent !== "save") {
    const issues = readinessIssues({ caption, platforms, hasImage: !!imagePath });
    if (issues.length) return { error: issues.join(" ") };
  }

  const channelsChanged = existingChannels.length !== channelIds.length || channelIds.some((c) => !existingChannels.includes(c));
  let status: SocialPostStatus = existing?.status ?? "requested";
  if (input.intent === "submit") status = "waiting_approval";
  if (input.intent === "approve") status = "approved";
  // Changing where an approved post goes needs approving again, like changing its words
  // (the database handles the words; channels live in their own table).
  if (input.intent === "save" && status === "approved" && channelsChanged && !isAdmin) status = "waiting_approval";

  const values = {
    title,
    caption,
    initiative_id: input.initiativeId,
    scheduled_at: scheduledAt,
    status,
    ...(input.image !== undefined ? { image_path: input.image?.path ?? null, image_name: input.image?.name.slice(0, 200) ?? null } : {}),
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("social_posts").update(values).eq("id", id);
    if (error) return { error: error.code === "42501" ? "Only an admin can approve posts." : SAVE_FAILED };
  } else {
    const { data, error } = await supabase.from("social_posts").insert(values).select("id").single();
    if (error || !data) return { error: error?.code === "42501" ? "Only an admin can approve posts." : SAVE_FAILED };
    id = data.id;
  }

  if (channelsChanged) {
    const removed = existingChannels.filter((c) => !channelIds.includes(c));
    const added = channelIds.filter((c) => !existingChannels.includes(c));
    if (removed.length) {
      const { error } = await supabase.from("social_post_channels").delete().eq("post_id", id).in("channel_id", removed);
      if (error) return { error: "The post saved, but its channels didn't update. Please try again.", id };
    }
    if (added.length) {
      const { error } = await supabase.from("social_post_channels").insert(added.map((channel_id) => ({ post_id: id!, channel_id })));
      if (error) return { error: "The post saved, but its channels didn't update. Please try again.", id };
    }
  }

  // The old image is no longer used once replaced or removed.
  if (existing?.image_path && input.image !== undefined && existing.image_path !== imagePath) {
    const { error } = await supabase.storage.from("marketing-images").remove([existing.image_path]);
    if (error) console.error("Removing a replaced marketing image failed:", error);
  }

  revalidate();
  return { id: id! };
}

/** Approve, send back with a note, or submit, straight from the approvals board. */
export async function setPostStatus(postId: string, next: SocialPostStatus, note?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!UUID.test(postId)) return { error: "That post wasn't found." };
  if (next === "approved" && user.role !== "admin") return { error: "Only an admin can approve posts." };

  const supabase = await createClient();
  const [{ data: post, error }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("social_posts").select("caption, image_path, status").eq("id", postId).maybeSingle(),
    supabase.from("social_post_channels").select("channel_id").eq("post_id", postId),
  ]);
  if (error || linksError) return { error: SAVE_FAILED };
  if (!post) return { error: "That post wasn't found. It may have been deleted." };
  if (post.status === next) return { id: postId };

  if (next !== "requested") {
    const platforms = await platformsFor(supabase, (links ?? []).map((l) => l.channel_id));
    const issues = readinessIssues({ caption: post.caption, platforms: platforms ?? [], hasImage: !!post.image_path });
    if (issues.length) return { error: `Not ready yet: ${issues.join(" ")}` };
  }

  const reviewNote = next === "requested" ? note?.trim().slice(0, 1000) || null : undefined;
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({ status: next, ...(reviewNote !== undefined ? { review_note: reviewNote } : {}) })
    .eq("id", postId);
  if (updateError) return { error: updateError.code === "42501" ? "Only an admin can approve posts." : SAVE_FAILED };
  revalidate();
  return { id: postId };
}

export async function deletePost(postId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!UUID.test(postId)) return { error: "That post wasn't found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_posts").delete().eq("id", postId).select("image_path");
  if (error) return { error: "That post wasn't deleted. Please try again." };
  if (!data || data.length === 0) return { error: "Only the person who created this post, or an admin, can delete it." };
  if (data[0].image_path) {
    const { error: storageError } = await supabase.storage.from("marketing-images").remove([data[0].image_path]);
    if (storageError) console.error("Removing a deleted post's image failed:", storageError);
  }
  revalidate();
  return {};
}

export type InitiativeInput = {
  id: string | null;
  name: string;
  objective: string;
  ownerId: string | null;
  eventId: string | null;
  startsOn: string;
  endsOn: string;
  budget: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveInitiative(input: InitiativeInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const name = input.name.trim();
  if (!name) return { error: "Name the initiative." };
  if (input.id && !UUID.test(input.id)) return { error: "That initiative wasn't found." };
  for (const id of [input.ownerId, input.eventId]) if (id && !UUID.test(id)) return { error: "Choose from the lists." };
  if ((input.startsOn && !DATE.test(input.startsOn)) || (input.endsOn && !DATE.test(input.endsOn))) return { error: "Check the dates." };
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return { error: "The end date is before the start date." };
  const budget = input.budget.trim() === "" ? null : Number(input.budget);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: "Enter the budget as an amount in dollars, or leave it blank." };

  const values = {
    name: name.slice(0, 200),
    objective: input.objective.trim() || null,
    owner_id: input.ownerId,
    event_id: input.eventId,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    budget,
  };
  const supabase = await createClient();
  if (input.id) {
    const { data, error } = await supabase.from("marketing_initiatives").update(values).eq("id", input.id).select("id");
    if (error) return { error: SAVE_FAILED };
    if (!data?.length) return { error: "That initiative wasn't found. It may have been deleted." };
    revalidate();
    return { id: input.id };
  }
  const { data, error } = await supabase.from("marketing_initiatives").insert(values).select("id").single();
  if (error || !data) return { error: SAVE_FAILED };
  revalidate();
  return { id: data.id };
}

/** Its posts stay, unlinked from it. */
export async function deleteInitiative(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!UUID.test(id)) return { error: "That initiative wasn't found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("marketing_initiatives").delete().eq("id", id).select("id");
  if (error) return { error: "That initiative wasn't deleted. Please try again." };
  if (!data?.length) return { error: "Only the person who created this initiative, or an admin, can delete it." };
  revalidate();
  return {};
}

export async function saveChannel(input: { id: string | null; platform: string; name: string; handle: string; active: boolean }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (user.role !== "admin") return { error: "Only an admin can change channels." };
  if (!isPlatform(input.platform)) return { error: "Choose LinkedIn, Facebook or Instagram." };
  const name = input.name.trim();
  if (!name) return { error: "Name the channel, e.g. Catapult on LinkedIn." };
  if (input.id && !UUID.test(input.id)) return { error: "That channel wasn't found." };
  const values = { platform: input.platform, name: name.slice(0, 120), handle: input.handle.trim().replace(/^@/, "") || null, active: input.active };
  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("marketing_channels").update(values).eq("id", input.id)
    : await supabase.from("marketing_channels").insert(values);
  if (error) return { error: error.code === "23505" ? "There's already a channel with that name on this platform." : SAVE_FAILED };
  revalidate();
  return {};
}
