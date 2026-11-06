import { isClientType, isLeadProgram } from "@/lib/leads/classification";
import type { LeadStatus } from "@/lib/supabase/types";

export const ALL_STATUSES: LeadStatus[] = ["new", "researching", "contacted", "qualified", "won", "lost", "unqualified"];
export const TABLE_PAGE_SIZE = 25;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  researching: "Researching",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
  unqualified: "Unqualified",
};

export type LeadSort = "score" | "name" | "created" | "status" | "client_type";

/** Everything that narrows the list. Kept in the URL, so a view can be shared or bookmarked. */
export type LeadFilters = {
  q: string;
  owner: string;
  industry: string;
  community: string;
  score: string;
  contact: string;
  event: string;
  status: string;
  clientType: string;
  program: string;
  proposal: string;
};

export type LeadViewState = LeadFilters & { sort: LeadSort; desc: boolean; page: number };

const SORTS: LeadSort[] = ["score", "name", "created", "status", "client_type"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLeadView(params: Record<string, string | undefined>): LeadViewState {
  const sort = SORTS.find((s) => s === params.sort) ?? "score";
  return {
    q: (params.q ?? "").slice(0, 200),
    owner: params.owner === "unassigned" || UUID.test(params.owner ?? "") ? params.owner! : "",
    industry: params.industry ?? "",
    community: params.community ?? "",
    score: params.score === "40" || params.score === "70" ? params.score : "",
    contact: ["has_contact", "has_email", "none"].includes(params.contact ?? "") ? params.contact! : "",
    event: UUID.test(params.event ?? "") ? params.event! : "",
    status: ALL_STATUSES.includes(params.status as LeadStatus) ? params.status! : "",
    clientType: params.clientType === "none" || isClientType(params.clientType) ? params.clientType! : "",
    program: params.program === "none" || isLeadProgram(params.program) ? params.program! : "",
    proposal: params.proposal === "has" || params.proposal === "none" ? params.proposal : "",
    sort,
    desc: params.dir ? params.dir === "desc" : sort === "score" || sort === "created",
    page: Math.max(1, Number(params.page) || 1),
  };
}

export function leadViewToParams(state: LeadViewState): URLSearchParams {
  const sp = new URLSearchParams();
  (["q", "owner", "industry", "community", "score", "contact", "event", "status", "clientType", "program", "proposal"] as const).forEach((key) => {
    if (state[key]) sp.set(key, state[key]);
  });
  if (state.sort !== "score") sp.set("sort", state.sort);
  const defaultDesc = state.sort === "score" || state.sort === "created";
  if (state.desc !== defaultDesc) sp.set("dir", state.desc ? "desc" : "asc");
  if (state.page > 1) sp.set("page", String(state.page));
  return sp;
}
