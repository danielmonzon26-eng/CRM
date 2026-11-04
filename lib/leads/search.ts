import { createClient } from "@/lib/supabase/server";
import { ALL_STATUSES, BOARD_PAGE_SIZE, BOARD_STATUSES, TABLE_PAGE_SIZE, type LeadFilters, type LeadSort, type LeadViewState } from "@/lib/leads/filters";
import type { LeadStatus } from "@/lib/supabase/types";

export type LeadRow = {
  id: string;
  status: LeadStatus;
  score: number;
  assignedTo: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
  community: string | null;
  industry: string | null;
  primaryName: string | null;
  primaryTitle: string | null;
  primaryEmail: string | null;
  contactCount: number;
};

export type StageSummary = { status: LeadStatus; count: number; openValue: number };
export type BoardColumn = StageSummary & { leads: LeadRow[] };
export type LeadFacets = { industries: string[]; communities: string[] };

function filterArgs(filters: LeadFilters) {
  return {
    p_search: filters.q || null,
    p_owner: filters.owner || null,
    p_industry: filters.industry || null,
    p_community: filters.community || null,
    p_min_score: filters.score ? Number(filters.score) : null,
    p_contact: filters.contact || null,
    p_event_id: filters.event || null,
  };
}

export async function searchLeads(
  filters: LeadFilters,
  options: { statuses?: string[] | null; sort: LeadSort; desc: boolean; limit: number; offset: number }
): Promise<{ rows: LeadRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_search_leads", {
    ...filterArgs(filters),
    p_statuses: options.statuses ?? null,
    p_sort: options.sort,
    p_descending: options.desc,
    p_limit: options.limit,
    p_offset: options.offset,
  });
  if (error) throw error;

  return {
    total: data.length ? Number(data[0].total_count) : 0,
    rows: data.map((r) => ({
      id: r.id,
      status: r.status as LeadStatus,
      score: r.score,
      assignedTo: r.assigned_to,
      createdAt: r.created_at,
      companyId: r.company_id,
      companyName: r.company_name,
      community: r.community,
      industry: r.industry,
      primaryName: r.primary_name,
      primaryTitle: r.primary_title,
      primaryEmail: r.primary_email,
      contactCount: r.contact_count,
    })),
  };
}

export async function getStageSummaries(filters: LeadFilters): Promise<StageSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_lead_stage_counts", filterArgs(filters));
  if (error) throw error;
  const byStatus = new Map(data.map((row) => [row.status, row]));
  return ALL_STATUSES.map((status) => ({
    status,
    count: Number(byStatus.get(status)?.lead_count ?? 0),
    openValue: Number(byStatus.get(status)?.open_value ?? 0),
  }));
}

export async function getLeadFacets(): Promise<LeadFacets> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_lead_facets");
  if (error) throw error;
  return data;
}

export async function getLeadBoard(state: LeadViewState): Promise<BoardColumn[]> {
  const summaries = await getStageSummaries(state);
  const statuses = state.status
    ? [state.status as LeadStatus]
    : state.unqualified
      ? [...BOARD_STATUSES, "unqualified" as const]
      : BOARD_STATUSES;
  return Promise.all(
    statuses.map(async (status) => {
      const { rows } = await searchLeads(state, { statuses: [status], sort: state.sort, desc: state.desc, limit: BOARD_PAGE_SIZE, offset: 0 });
      return { ...summaries.find((s) => s.status === status)!, leads: rows };
    })
  );
}

export async function getLeadTablePage(state: LeadViewState) {
  return searchLeads(state, {
    statuses: state.status ? [state.status] : null,
    sort: state.sort,
    desc: state.desc,
    limit: TABLE_PAGE_SIZE,
    offset: (state.page - 1) * TABLE_PAGE_SIZE,
  });
}
