import type { LeadStatus } from "@/lib/supabase/types";

export const BOARD_STATUSES: LeadStatus[] = ["new", "researching", "contacted", "qualified", "won", "lost"];
export const ALL_STATUSES: LeadStatus[] = [...BOARD_STATUSES, "unqualified"];
export const BOARD_PAGE_SIZE = 20;
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

export type LeadSort = "score" | "name" | "created" | "status";

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
};

export type LeadViewState = LeadFilters & { sort: LeadSort; desc: boolean; page: number; view: "board" | "table"; unqualified: boolean };

const SORTS: LeadSort[] = ["score", "name", "created", "status"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLeadView(params: Record<string, string | undefined>, defaultView: "board" | "table"): LeadViewState {
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
    sort,
    desc: params.dir ? params.dir === "desc" : sort === "score" || sort === "created",
    page: Math.max(1, Number(params.page) || 1),
    view: params.view === "board" || params.view === "table" ? params.view : defaultView,
    unqualified: params.unqualified === "1",
  };
}

export function leadViewToParams(state: LeadViewState, defaultView: "board" | "table"): URLSearchParams {
  const sp = new URLSearchParams();
  (["q", "owner", "industry", "community", "score", "contact", "event", "status"] as const).forEach((key) => {
    if (state[key]) sp.set(key, state[key]);
  });
  if (state.sort !== "score") sp.set("sort", state.sort);
  const defaultDesc = state.sort === "score" || state.sort === "created";
  if (state.desc !== defaultDesc) sp.set("dir", state.desc ? "desc" : "asc");
  if (state.page > 1) sp.set("page", String(state.page));
  if (state.view !== defaultView) sp.set("view", state.view);
  if (state.unqualified) sp.set("unqualified", "1");
  return sp;
}
