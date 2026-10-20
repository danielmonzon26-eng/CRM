import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { DealStage } from "@/lib/supabase/types";
import { effectiveProbability, OPEN_DEAL_STAGES } from "@/lib/deals/stages";

export type DealListRow = {
  id: string;
  name: string;
  stage: DealStage;
  amount: number;
  currency: string;
  expectedCloseDate: string;
  probability: number;
  nextStep: string | null;
  nextStepDueDate: string | null;
  companyId: string;
  companyName: string;
  primaryContactName: string | null;
  leadId: string | null;
  owner: string | null;
};

async function attachCompanyAndContactNames<T extends { companyId: string; primaryContactId: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: T[]
): Promise<Map<string, { companyName: string; contactName: string | null }>> {
  const companies = await fetchAllPages((from, to) => supabase.from("companies").select("id, name").range(from, to));
  const companyById = new Map(companies.map((c) => [c.id, c.name]));

  const contacts = await fetchAllPages((from, to) =>
    supabase.from("contacts").select("id, full_name").range(from, to)
  );
  const contactById = new Map(contacts.map((c) => [c.id, c.full_name]));

  const result = new Map<string, { companyName: string; contactName: string | null }>();
  for (const row of rows) {
    result.set((row as unknown as { id: string }).id, {
      companyName: companyById.get(row.companyId) ?? "Unknown company",
      contactName: row.primaryContactId ? contactById.get(row.primaryContactId) ?? null : null,
    });
  }
  return result;
}

export async function getDealsBoard(): Promise<DealListRow[]> {
  const supabase = await createClient();

  const deals = await fetchAllPages((from, to) =>
    supabase
      .from("deals")
      .select(
        "id, name, stage, amount, currency, expected_close_date, probability, next_step, next_step_due_date, company_id, primary_contact_id, lead_id, owner"
      )
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  if (deals.length === 0) return [];

  const names = await attachCompanyAndContactNames(
    supabase,
    deals.map((d) => ({ id: d.id, companyId: d.company_id, primaryContactId: d.primary_contact_id }))
  );

  return deals.map((d) => {
    const meta = names.get(d.id);
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      amount: d.amount,
      currency: d.currency,
      expectedCloseDate: d.expected_close_date,
      probability: effectiveProbability(d.stage, d.probability),
      nextStep: d.next_step,
      nextStepDueDate: d.next_step_due_date,
      companyId: d.company_id,
      companyName: meta?.companyName ?? "Unknown company",
      primaryContactName: meta?.contactName ?? null,
      leadId: d.lead_id,
      owner: d.owner,
    };
  });
}

export type PipelineForecast = {
  openCount: number;
  openValue: number;
  weightedValue: number;
  closedWonCount: number;
  closedWonValue: number;
  closedLostCount: number;
};

export async function getPipelineForecast(): Promise<PipelineForecast> {
  const supabase = await createClient();

  const deals = await fetchAllPages((from, to) =>
    supabase.from("deals").select("stage, amount, probability").range(from, to)
  );

  let openCount = 0;
  let openValue = 0;
  let weightedValue = 0;
  let closedWonCount = 0;
  let closedWonValue = 0;
  let closedLostCount = 0;

  for (const d of deals) {
    if (d.stage === "closed_won") {
      closedWonCount++;
      closedWonValue += d.amount;
    } else if (d.stage === "closed_lost") {
      closedLostCount++;
    } else if (OPEN_DEAL_STAGES.includes(d.stage)) {
      openCount++;
      openValue += d.amount;
      weightedValue += (d.amount * effectiveProbability(d.stage, d.probability)) / 100;
    }
  }

  return { openCount, openValue, weightedValue, closedWonCount, closedWonValue, closedLostCount };
}

export type DealDetail = {
  id: string;
  name: string;
  stage: DealStage;
  amount: number;
  currency: string;
  expectedCloseDate: string;
  probability: number;
  pipeline: string;
  leadSource: string | null;
  nextStep: string | null;
  nextStepDueDate: string | null;
  competitors: string | null;
  lostReason: string | null;
  closedAt: string | null;
  notes: string | null;
  companyId: string;
  companyName: string;
  primaryContactId: string | null;
  leadId: string | null;
  owner: string | null;
  createdAt: string;
};

export async function getDealDetail(dealId: string): Promise<DealDetail | null> {
  const supabase = await createClient();
  const { data: deal, error } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (error) throw error;
  if (!deal) return null;

  const { data: company } = await supabase.from("companies").select("name").eq("id", deal.company_id).maybeSingle();

  return {
    id: deal.id,
    name: deal.name,
    stage: deal.stage,
    amount: deal.amount,
    currency: deal.currency,
    expectedCloseDate: deal.expected_close_date,
    probability: effectiveProbability(deal.stage, deal.probability),
    pipeline: deal.pipeline,
    leadSource: deal.lead_source,
    nextStep: deal.next_step,
    nextStepDueDate: deal.next_step_due_date,
    competitors: deal.competitors,
    lostReason: deal.lost_reason,
    closedAt: deal.closed_at,
    notes: deal.notes,
    companyId: deal.company_id,
    companyName: company?.name ?? "Unknown company",
    primaryContactId: deal.primary_contact_id,
    leadId: deal.lead_id,
    owner: deal.owner,
    createdAt: deal.created_at,
  };
}

export type DealStageHistoryRow = {
  id: string;
  fromStage: DealStage | null;
  toStage: DealStage;
  changedAt: string;
};

export async function getDealStageHistory(dealId: string): Promise<DealStageHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_stage_history")
    .select("id, from_stage, to_stage, changed_at")
    .eq("deal_id", dealId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h) => ({ id: h.id, fromStage: h.from_stage, toStage: h.to_stage, changedAt: h.changed_at }));
}

export async function getDealsForLead(leadId: string): Promise<DealListRow[]> {
  const all = await getDealsBoard();
  return all.filter((d) => d.leadId === leadId);
}

export async function getDealsForCompany(companyId: string): Promise<DealListRow[]> {
  const all = await getDealsBoard();
  return all.filter((d) => d.companyId === companyId);
}
