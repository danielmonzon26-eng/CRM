import { createClient } from "@/lib/supabase/server";
import { ALL_ENGAGEMENTS, ALL_STATUSES, TABLE_PAGE_SIZE, type LeadFilters, type LeadSort, type LeadViewState } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

export type LeadRow = {
  id: string;
  status: LeadStatus;
  engagement: LeadEngagement;
  score: number;
  assignedTo: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
  community: string | null;
  industry: string | null;
  clientType: string | null;
  programs: string[];
  primaryName: string | null;
  primaryTitle: string | null;
  primaryEmail: string | null;
  primaryContactId: string | null;
  contactCount: number;
  proposalId: string | null;
  proposalStage: string | null;
  /** Completion % of the latest discovery call, if there's been one. */
  bmcScore: number | null;
};

export type StageSummary = { status: LeadStatus; count: number; openValue: number };
export type EngagementSummary = { engagement: LeadEngagement; count: number };
export type LeadFacets = { industries: string[]; communities: string[] };

function filterArgs(filters: LeadFilters) {
  return {
    p_search: filters.q || null,
    // Leads opens on Engaged companies; the Status filter can show the others or all of them.
    p_engagement: filters.engagement === "all" ? null : filters.engagement || "engaged",
    p_industry: filters.industry || null,
    p_community: filters.community || null,
    p_min_score: filters.score ? Number(filters.score) : null,
    p_contact: filters.contact || null,
    p_event_id: filters.event || null,
    p_client_type: filters.clientType || null,
    p_program: filters.program || null,
    p_proposal: filters.proposal || null,
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
      engagement: r.engagement as LeadEngagement,
      score: r.score,
      assignedTo: r.assigned_to,
      createdAt: r.created_at,
      companyId: r.company_id,
      companyName: r.company_name,
      community: r.community,
      industry: r.industry,
      clientType: r.client_type,
      programs: r.programs,
      primaryName: r.primary_name,
      primaryTitle: r.primary_title,
      primaryEmail: r.primary_email,
      primaryContactId: r.primary_contact_id,
      contactCount: r.contact_count,
      proposalId: r.proposal_id,
      proposalStage: r.proposal_stage,
      bmcScore: null,
    })),
  };
}

/** Fills in each row's latest discovery score (one small query per page). */
export async function withBmcScores(result: { rows: LeadRow[]; total: number }) {
  if (result.rows.length === 0) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("id, bmc_score").in("id", result.rows.map((r) => r.id));
  if (error) throw error;
  const scoreById = new Map(data.map((l) => [l.id, l.bmc_score == null ? null : Number(l.bmc_score)]));
  return { ...result, rows: result.rows.map((r) => ({ ...r, bmcScore: scoreById.get(r.id) ?? null })) };
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

/** How many leads have each status under the other filters (the Status filter itself is ignored). */
export async function getEngagementSummaries(filters: LeadFilters): Promise<EngagementSummary[]> {
  const supabase = await createClient();
  const base = { ...filterArgs(filters), p_engagement: null as string | null };
  const results = await Promise.all(
    ALL_ENGAGEMENTS.map(async (engagement) => {
      const { data, error } = await supabase.rpc("crm_lead_stage_counts", { ...base, p_engagement: engagement });
      if (error) throw error;
      // Within one status, an active Stage filter narrows the total to that stage.
      const rows = filters.status ? data.filter((r) => r.status === filters.status) : data;
      return { engagement, count: rows.reduce((total, r) => total + Number(r.lead_count), 0) };
    })
  );
  return results;
}

export async function getLeadFacets(): Promise<LeadFacets> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_lead_facets");
  if (error) throw error;
  return data;
}

export async function getLeadTablePage(state: LeadViewState) {
  return withBmcScores(await searchLeads(state, {
    statuses: state.status ? [state.status] : null,
    sort: state.sort,
    desc: state.desc,
    limit: TABLE_PAGE_SIZE,
    offset: (state.page - 1) * TABLE_PAGE_SIZE,
  }));
}
