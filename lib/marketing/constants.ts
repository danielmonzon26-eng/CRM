import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";

export type PlatformMeta = {
  key: SocialPlatform;
  label: string;
  /** The platform's caption limit, in characters. */
  limit: number;
  /** Roughly where the platform cuts the caption off with "see more". */
  foldAt: number;
  imageRequired: boolean;
};

export const PLATFORMS: PlatformMeta[] = [
  { key: "linkedin", label: "LinkedIn", limit: 3000, foldAt: 210, imageRequired: false },
  { key: "facebook", label: "Facebook", limit: 63206, foldAt: 480, imageRequired: false },
  { key: "instagram", label: "Instagram", limit: 2200, foldAt: 125, imageRequired: true },
];

export const PLATFORM_META = Object.fromEntries(PLATFORMS.map((p) => [p.key, p])) as Record<SocialPlatform, PlatformMeta>;

export const INSTAGRAM_HASHTAG_LIMIT = 30;

export const POST_STATUSES: SocialPostStatus[] = ["requested", "waiting_approval", "approved"];

export const POST_STATUS_META: Record<SocialPostStatus, { label: string; hint: string; pill: string; dot: string; column: string }> = {
  requested: {
    label: "Requested",
    hint: "Asked for, still being written",
    pill: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    column: "border-t-slate-400",
  },
  waiting_approval: {
    label: "Waiting approval",
    hint: "Ready, needs an admin to approve",
    pill: "bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    column: "border-t-amber-500",
  },
  approved: {
    label: "Approved",
    hint: "Good to post",
    pill: "bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    column: "border-t-emerald-500",
  },
};

export function isPostStatus(value: string): value is SocialPostStatus {
  return (POST_STATUSES as string[]).includes(value);
}

export function isPlatform(value: string): value is SocialPlatform {
  return PLATFORMS.some((p) => p.key === value);
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/**
 * What stops a post from going for approval: the things every platform needs, plus each
 * selected platform's own rules. An empty list means it's ready.
 */
export function readinessIssues(post: { caption: string; platforms: SocialPlatform[]; hasImage: boolean }): string[] {
  const issues: string[] = [];
  const caption = post.caption.trim();
  if (!caption) issues.push("Write the caption.");
  if (post.platforms.length === 0) issues.push("Choose at least one channel.");
  for (const key of new Set(post.platforms)) {
    const meta = PLATFORM_META[key];
    if (meta.imageRequired && !post.hasImage) issues.push(`${meta.label} posts need an image.`);
    if (caption.length > meta.limit) issues.push(`The caption is over ${meta.label}'s ${meta.limit.toLocaleString("en-CA")}-character limit.`);
  }
  if (post.platforms.includes("instagram") && countHashtags(caption) > INSTAGRAM_HASHTAG_LIMIT) {
    issues.push(`Instagram allows up to ${INSTAGRAM_HASHTAG_LIMIT} hashtags.`);
  }
  return issues;
}

/** Upcoming, active or finished, from an initiative's dates. */
export function initiativePhase(startsOn: string | null, endsOn: string | null, today: string): "upcoming" | "active" | "finished" | "undated" {
  if (!startsOn && !endsOn) return "undated";
  if (startsOn && today < startsOn) return "upcoming";
  if (endsOn && today > endsOn) return "finished";
  return "active";
}

export const PHASE_META = {
  upcoming: { label: "Upcoming", pill: "bg-sky-50 text-sky-800" },
  active: { label: "Active", pill: "bg-emerald-50 text-emerald-800" },
  finished: { label: "Finished", pill: "bg-slate-100 text-slate-600" },
  undated: { label: "No dates", pill: "bg-slate-100 text-slate-600" },
} as const;

/** "2 weeks before", "1 week before" or "1 day before", for an automatic request. */
export function autoRequestLabel(days: number | null): string | null {
  if (days === 14) return "2 weeks before";
  if (days === 7) return "1 week before";
  if (days === 1) return "1 day before";
  return null;
}
