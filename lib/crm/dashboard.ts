import { getPipelineForecast, getProposalBoard, type PipelineForecast, type ProposalRow } from "@/lib/deals/queries";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/leads/filters";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/types";

export type CrmDashboard = {
  forecast: PipelineForecast;
  proposals: { inDevelopment: number; sent: number; accepted: number; declined: number };
  /** Open proposals whose next step is due soonest, or overdue. */
  nextSteps: ProposalRow[];
  leads: { total: number; new30d: number; byStatus: { key: LeadStatus; label: string; count: number }[]; readyForProposal: number };
  contacts: number;
  companies: number;
  contactsByIndustry: { industry: string; count: number }[];
};

type Counts = {
  leads_by_status: Record<string, number>;
  new_leads_30d: number;
  contacts: number;
  companies: number;
  contacts_by_industry: { industry: string; count: number }[];
};

/** Everything the CRM dashboard shows: proposals, leads, contacts and companies. */
export async function getCrmDashboard(): Promise<CrmDashboard> {
  const supabase = await createClient();
  const [forecast, proposals, { data, error }] = await Promise.all([getPipelineForecast(), getProposalBoard(), supabase.rpc("crm_dashboard")]);
  if (error) throw error;
  const c = data as Counts;
  const byStatus = ALL_STATUSES.map((key) => ({ key, label: STATUS_LABELS[key], count: Number(c.leads_by_status?.[key] ?? 0) }));
  const open = proposals.filter((p) => p.stage === "in_development" || p.stage === "sent");
  return {
    forecast,
    proposals: {
      inDevelopment: proposals.filter((p) => p.stage === "in_development").length,
      sent: proposals.filter((p) => p.stage === "sent").length,
      accepted: proposals.filter((p) => p.stage === "accepted").length,
      declined: proposals.filter((p) => p.stage === "declined").length,
    },
    nextSteps: open
      .filter((p) => p.nextStepDueDate)
      .sort((a, b) => (a.nextStepDueDate ?? "").localeCompare(b.nextStepDueDate ?? ""))
      .slice(0, 6),
    leads: {
      total: byStatus.reduce((s, x) => s + x.count, 0),
      new30d: Number(c.new_leads_30d ?? 0),
      byStatus,
      // Leads past their pitch meeting are the ones to turn into proposals.
      readyForProposal: byStatus.find((x) => x.key === "pitch_meeting")?.count ?? 0,
    },
    contacts: Number(c.contacts ?? 0),
    companies: Number(c.companies ?? 0),
    contactsByIndustry: (c.contacts_by_industry ?? []).map((x) => ({ industry: x.industry, count: Number(x.count) })),
  };
}
