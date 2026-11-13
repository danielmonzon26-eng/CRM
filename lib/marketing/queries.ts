import { calgaryDateKey, EVENT_TIME_ZONE, toDateTimeInput } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";
import { personName } from "@/lib/team/names";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const whenFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const stampFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE });

export type Channel = { id: string; platform: SocialPlatform; name: string; handle: string | null; active: boolean };

export type PostItem = {
  id: string;
  title: string;
  caption: string;
  status: SocialPostStatus;
  scheduledAt: string | null;
  /** For the form: the scheduled time as a datetime-local value in Calgary time. */
  scheduledInput: string;
  scheduledLabel: string | null;
  timeLabel: string | null;
  dayKey: string | null;
  isPast: boolean;
  imageUrl: string | null;
  imagePath: string | null;
  imageName: string | null;
  channels: Channel[];
  platforms: SocialPlatform[];
  initiative: { id: string; name: string } | null;
  /** The event this post promotes, when it was requested automatically for one. */
  event: { id: string; title: string } | null;
  /** 14, 7 or 1 for an automatic request. */
  autoDaysBefore: number | null;
  /** 28, 14, 7 or 1 for a post planned from the event's page relative to its date. */
  eventDaysBefore: number | null;
  createdBy: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvedLabel: string | null;
  submittedLabel: string | null;
  reviewNote: string | null;
  updatedLabel: string;
};

export type InitiativeItem = {
  id: string;
  name: string;
  objective: string | null;
  ownerId: string | null;
  ownerName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  startsOn: string | null;
  endsOn: string | null;
  datesLabel: string;
  budget: number | null;
  createdBy: string | null;
  counts: Record<SocialPostStatus, number>;
  nextPostLabel: string | null;
};

export function formatDay(day: string | null): string | null {
  return day ? dayFormat.format(new Date(`${day}T00:00:00Z`)) : null;
}

function datesLabel(startsOn: string | null, endsOn: string | null): string {
  if (startsOn && endsOn) return `${formatDay(startsOn)} – ${formatDay(endsOn)}`;
  if (startsOn) return `From ${formatDay(startsOn)}`;
  if (endsOn) return `Until ${formatDay(endsOn)}`;
  return "No dates set";
}

async function nameMap(supabase: Supabase): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("profiles").select("id, email, full_name");
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, personName(p.full_name, p.email, "Unknown")]));
}

export async function getChannels(includeInactive = false): Promise<Channel[]> {
  const supabase = await createClient();
  let query = supabase.from("marketing_channels").select("id, platform, name, handle, active").order("sort_order").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

const POST_COLUMNS =
  "id, initiative_id, event_id, auto_days_before, event_days_before, title, caption, scheduled_at, status, image_path, image_name, review_note, created_by, submitted_at, approved_by, approved_at, updated_at";

type PostRow = {
  id: string;
  initiative_id: string | null;
  event_id: string | null;
  auto_days_before: number | null;
  event_days_before: number | null;
  title: string;
  caption: string;
  scheduled_at: string | null;
  status: SocialPostStatus;
  image_path: string | null;
  image_name: string | null;
  review_note: string | null;
  created_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
};

async function decoratePosts(supabase: Supabase, rows: PostRow[]): Promise<PostItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const initiativeIds = [...new Set(rows.map((r) => r.initiative_id).filter((x): x is string => !!x))];
  const paths = rows.map((r) => r.image_path).filter((x): x is string => !!x);
  const eventIds = [...new Set(rows.map((r) => r.event_id).filter((x): x is string => !!x))];

  const [links, channels, initiatives, names, signed, events] = await Promise.all([
    supabase.from("social_post_channels").select("post_id, channel_id").in("post_id", ids),
    supabase.from("marketing_channels").select("id, platform, name, handle, active"),
    initiativeIds.length ? supabase.from("marketing_initiatives").select("id, name").in("id", initiativeIds) : Promise.resolve({ data: [], error: null }),
    nameMap(supabase),
    paths.length ? supabase.storage.from("marketing-images").createSignedUrls(paths, 3600) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? supabase.from("events").select("id, title").in("id", eventIds) : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
  ]);
  if (events.error) throw events.error;
  const eventById = new Map((events.data ?? []).map((e) => [e.id, e]));
  if (links.error) throw links.error;
  if (channels.error) throw channels.error;
  if (initiatives.error) throw initiatives.error;
  // A missing preview isn't worth failing the page over; the post still shows without it.
  if (signed.error) console.error("Marketing image links failed:", signed.error);

  const channelById = new Map((channels.data ?? []).map((c) => [c.id, c as Channel]));
  const channelsByPost = new Map<string, Channel[]>();
  for (const l of links.data ?? []) {
    const c = channelById.get(l.channel_id);
    if (c) channelsByPost.set(l.post_id, [...(channelsByPost.get(l.post_id) ?? []), c]);
  }
  const initiativeById = new Map((initiatives.data ?? []).map((i) => [i.id, i]));
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const now = Date.now();

  return rows.map((r) => {
    const postChannels = (channelsByPost.get(r.id) ?? []).sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name));
    return {
      id: r.id,
      title: r.title,
      caption: r.caption,
      status: r.status,
      scheduledAt: r.scheduled_at,
      scheduledInput: toDateTimeInput(r.scheduled_at),
      scheduledLabel: r.scheduled_at ? whenFormat.format(new Date(r.scheduled_at)) : null,
      timeLabel: r.scheduled_at ? timeFormat.format(new Date(r.scheduled_at)) : null,
      dayKey: r.scheduled_at ? calgaryDateKey(r.scheduled_at) : null,
      isPast: !!r.scheduled_at && new Date(r.scheduled_at).getTime() < now,
      imageUrl: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
      imagePath: r.image_path,
      imageName: r.image_name,
      channels: postChannels,
      platforms: [...new Set(postChannels.map((c) => c.platform))],
      initiative: r.initiative_id ? initiativeById.get(r.initiative_id) ?? null : null,
      event: r.event_id ? eventById.get(r.event_id) ?? null : null,
      autoDaysBefore: r.auto_days_before,
      eventDaysBefore: r.event_days_before,
      createdBy: r.created_by,
      createdByName: r.created_by ? names.get(r.created_by) ?? null : null,
      approvedByName: r.approved_by ? names.get(r.approved_by) ?? null : null,
      approvedLabel: r.approved_at ? stampFormat.format(new Date(r.approved_at)) : null,
      submittedLabel: r.submitted_at ? stampFormat.format(new Date(r.submitted_at)) : null,
      reviewNote: r.review_note,
      updatedLabel: stampFormat.format(new Date(r.updated_at)),
    };
  });
}

/** Posts scheduled in a range (inclusive start, exclusive end), plus every unscheduled post when asked. */
export async function getPosts(options: { from?: string; to?: string; initiativeId?: string; eventId?: string; includeUnscheduled?: boolean } = {}): Promise<PostItem[]> {
  const supabase = await createClient();
  let query = supabase.from("social_posts").select(POST_COLUMNS);
  if (options.initiativeId) query = query.eq("initiative_id", options.initiativeId);
  if (options.eventId) query = query.eq("event_id", options.eventId);
  if (options.from && options.to) {
    const range = `and(scheduled_at.gte.${options.from},scheduled_at.lt.${options.to})`;
    query = query.or(options.includeUnscheduled ? `${range},scheduled_at.is.null` : range);
  }
  const { data, error } = await query.order("scheduled_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return decoratePosts(supabase, data as PostRow[]);
}

export async function getPost(id: string): Promise<PostItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await decoratePosts(supabase, [data as PostRow]))[0];
}

/** The number on the Marketing nav link for admins. */
export async function getWaitingApprovalCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "waiting_approval");
  if (error) throw error;
  return count ?? 0;
}

export async function getInitiatives(): Promise<InitiativeItem[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: posts, error: postsError }, names] = await Promise.all([
    supabase.from("marketing_initiatives").select("*").order("starts_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("social_posts").select("initiative_id, status, scheduled_at").not("initiative_id", "is", null),
    nameMap(supabase),
  ]);
  if (error) throw error;
  if (postsError) throw postsError;
  const eventIds = [...new Set((data ?? []).map((i) => i.event_id).filter((x): x is string => !!x))];
  const { data: events, error: eventsError } = eventIds.length
    ? await supabase.from("events").select("id, title").in("id", eventIds)
    : { data: [] as { id: string; title: string }[], error: null };
  if (eventsError) throw eventsError;
  const eventTitle = new Map((events ?? []).map((e) => [e.id, e.title]));
  const now = Date.now();

  return (data ?? []).map((i) => {
    const mine = (posts ?? []).filter((p) => p.initiative_id === i.id);
    const counts = { requested: 0, waiting_approval: 0, approved: 0 } as Record<SocialPostStatus, number>;
    for (const p of mine) counts[p.status as SocialPostStatus] += 1;
    const next = mine
      .filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= now)
      .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0];
    return {
      id: i.id,
      name: i.name,
      objective: i.objective,
      ownerId: i.owner_id,
      ownerName: i.owner_id ? names.get(i.owner_id) ?? null : null,
      eventId: i.event_id,
      eventTitle: i.event_id ? eventTitle.get(i.event_id) ?? null : null,
      startsOn: i.starts_on,
      endsOn: i.ends_on,
      datesLabel: datesLabel(i.starts_on, i.ends_on),
      budget: i.budget === null ? null : Number(i.budget),
      createdBy: i.created_by,
      counts,
      nextPostLabel: next ? whenFormat.format(new Date(next.scheduled_at!)) : null,
    };
  });
}

export async function getInitiative(id: string): Promise<InitiativeItem | null> {
  return (await getInitiatives()).find((i) => i.id === id) ?? null;
}

/** Events to link an initiative to: upcoming ones first, then the rest of the last year. */
export async function getEventOptions(): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data, error } = await supabase.from("events").select("id, title, starts_at").is("archived_at", null).gte("starts_at", since).order("starts_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((e) => ({ id: e.id, title: e.title }));
}
