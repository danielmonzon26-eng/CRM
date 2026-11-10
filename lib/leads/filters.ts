import { isClientType, isLeadProgram } from "@/lib/leads/classification";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

/** Funnel stages, in order. Stored in leads.status and shown as "Stage". */
export const ALL_STATUSES: LeadStatus[] = ["engagement", "in_contact", "discovery_meeting", "pitch_meeting", "proposal", "client"];
export const TABLE_PAGE_SIZE = 25;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  engagement: "Engagement or Education",
  in_contact: "In Contact",
  discovery_meeting: "Discovery Meeting",
  pitch_meeting: "Pitch Meeting",
  proposal: "Proposal",
  client: "Client",
};

export const STATUS_STYLES: Record<LeadStatus, string> = {
  engagement: "bg-sky-50 text-sky-800",
  in_contact: "bg-indigo-50 text-indigo-800",
  discovery_meeting: "bg-amber-50 text-amber-800",
  pitch_meeting: "bg-orange-50 text-orange-800",
  proposal: "bg-violet-50 text-violet-800",
  client: "bg-emerald-50 text-emerald-800",
};

export const STATUS_DOTS: Record<LeadStatus, string> = {
  engagement: "bg-sky-500",
  in_contact: "bg-indigo-500",
  discovery_meeting: "bg-amber-500",
  pitch_meeting: "bg-orange-500",
  proposal: "bg-violet-500",
  client: "bg-emerald-600",
};

/** Stored in leads.engagement and shown as "Status". */
export const ALL_ENGAGEMENTS: LeadEngagement[] = ["engaged", "not_engaged", "do_not_contact"];

export const ENGAGEMENT_LABELS: Record<LeadEngagement, string> = {
  engaged: "Engaged",
  not_engaged: "Not Engaged",
  do_not_contact: "Do Not Contact",
};

export const ENGAGEMENT_STYLES: Record<LeadEngagement, string> = {
  engaged: "bg-emerald-50 text-emerald-800",
  not_engaged: "bg-slate-100 text-slate-700",
  do_not_contact: "bg-rose-50 text-rose-800",
};

export function isLeadEngagement(value: unknown): value is LeadEngagement {
  return ALL_ENGAGEMENTS.includes(value as LeadEngagement);
}

export type LeadSort = "score" | "name" | "created" | "status" | "client_type";

/** Everything that narrows the list. Kept in the URL, so a view can be shared or bookmarked. */
export type LeadFilters = {
  q: string;
  industry: string;
  community: string;
  score: string;
  contact: string;
  event: string;
  status: string;
  clientType: string;
  program: string;
  proposal: string;
  /** Empty means Engaged (the default view); "all" means every status. */
  engagement: string;
};

export type LeadViewState = LeadFilters & { sort: LeadSort; desc: boolean; page: number };

const SORTS: LeadSort[] = ["score", "name", "created", "status", "client_type"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLeadView(params: Record<string, string | undefined>): LeadViewState {
  const sort = SORTS.find((s) => s === params.sort) ?? "score";
  return {
    q: (params.q ?? "").slice(0, 200),
    industry: params.industry ?? "",
    community: params.community ?? "",
    score: params.score === "40" || params.score === "70" ? params.score : "",
    contact: ["has_contact", "has_email", "none"].includes(params.contact ?? "") ? params.contact! : "",
    event: UUID.test(params.event ?? "") ? params.event! : "",
    status: ALL_STATUSES.includes(params.status as LeadStatus) ? params.status! : "",
    clientType: params.clientType === "none" || isClientType(params.clientType) ? params.clientType! : "",
    program: params.program === "none" || isLeadProgram(params.program) ? params.program! : "",
    proposal: params.proposal === "has" || params.proposal === "none" ? params.proposal : "",
    engagement: params.engagement === "all" || (isLeadEngagement(params.engagement) && params.engagement !== "engaged") ? params.engagement! : "",
    sort,
    desc: params.dir ? params.dir === "desc" : sort === "score" || sort === "created",
    page: Math.max(1, Number(params.page) || 1),
  };
}

export function leadViewToParams(state: LeadViewState): URLSearchParams {
  const sp = new URLSearchParams();
  (["q", "industry", "community", "score", "contact", "event", "status", "clientType", "program", "proposal", "engagement"] as const).forEach((key) => {
    if (state[key]) sp.set(key, state[key]);
  });
  if (state.sort !== "score") sp.set("sort", state.sort);
  const defaultDesc = state.sort === "score" || state.sort === "created";
  if (state.desc !== defaultDesc) sp.set("dir", state.desc ? "desc" : "asc");
  if (state.page > 1) sp.set("page", String(state.page));
  return sp;
}
