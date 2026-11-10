import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { DealPayment, DealStage } from "@/lib/supabase/types";
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
  createdAt: string;
  workTypes: string[];
  payment: DealPayment | null;
  sentOn: string | null;
  acceptedOn: string | null;
  closedAt: string | null;
  staffIds: string[];
  fileCount: number;
};

export type ProposalRow = DealListRow & { clientType: string | null };

const ID_BATCH_SIZE = 200;

function idBatches(ids: (string | null)[]): string[][] {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_BATCH_SIZE) batches.push(unique.slice(i, i + ID_BATCH_SIZE));
  return batches;
}

async function attachCompanyAndContactNames<T extends { companyId: string; primaryContactId: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: T[]
): Promise<Map<string, { companyName: string; contactName: string | null }>> {
  const companies = await Promise.all(
    idBatches(rows.map((r) => r.companyId)).map(async (ids) => {
      const { data, error } = await supabase.from("companies").select("id, name").in("id", ids);
      if (error) throw error;
      return data;
    })
  );
  const companyById = new Map(companies.flat().map((c) => [c.id, c.name]));

  const contacts = await Promise.all(
    idBatches(rows.map((r) => r.primaryContactId)).map(async (ids) => {
      const { data, error } = await supabase.from("contacts").select("id, full_name").in("id", ids);
      if (error) throw error;
      return data;
    })
  );
  const contactById = new Map(contacts.flat().map((c) => [c.id, c.full_name]));

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
        "id, name, stage, amount, currency, expected_close_date, probability, next_step, next_step_due_date, company_id, primary_contact_id, lead_id, owner, created_at, work_types, payment, sent_on, accepted_on, closed_at"
      )
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  if (deals.length === 0) return [];

  const [names, staff, files] = await Promise.all([
    attachCompanyAndContactNames(
      supabase,
      deals.map((d) => ({ id: d.id, companyId: d.company_id, primaryContactId: d.primary_contact_id }))
    ),
    fetchAllPages((from, to) => supabase.from("deal_staff").select("deal_id, user_id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("deal_files").select("deal_id").range(from, to)),
  ]);
  const staffByDeal = new Map<string, string[]>();
  for (const s of staff) staffByDeal.set(s.deal_id, [...(staffByDeal.get(s.deal_id) ?? []), s.user_id]);
  const filesByDeal = new Map<string, number>();
  for (const f of files) filesByDeal.set(f.deal_id, (filesByDeal.get(f.deal_id) ?? 0) + 1);

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
      createdAt: d.created_at,
      workTypes: d.work_types,
      payment: d.payment,
      sentOn: d.sent_on,
      acceptedOn: d.accepted_on,
      closedAt: d.closed_at,
      staffIds: staffByDeal.get(d.id) ?? [],
      fileCount: filesByDeal.get(d.id) ?? 0,
    };
  });
}

/** Every proposal, with the client type of the lead it came from. */
export async function getProposalBoard(): Promise<ProposalRow[]> {
  const deals = await getDealsBoard();
  const supabase = await createClient();
  const leads = await Promise.all(
    idBatches(deals.map((d) => d.leadId)).map(async (ids) => {
      const { data, error } = await supabase.from("leads").select("id, client_type").in("id", ids);
      if (error) throw error;
      return data;
    })
  );
  const leadById = new Map(leads.flat().map((l) => [l.id, l]));
  return deals.map((deal) => {
    const lead = deal.leadId ? leadById.get(deal.leadId) : undefined;
    return { ...deal, clientType: lead?.client_type ?? null };
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
    if (d.stage === "accepted") {
      closedWonCount++;
      closedWonValue += d.amount;
    } else if (d.stage === "declined") {
      closedLostCount++;
    } else if (OPEN_DEAL_STAGES.includes(d.stage)) {
      openCount++;
      openValue += d.amount;
      weightedValue += (d.amount * effectiveProbability(d.stage, d.probability)) / 100;
    }
  }

  return { openCount, openValue, weightedValue, closedWonCount, closedWonValue, closedLostCount };
}

export type DealFile = { id: string; fileName: string; sizeBytes: number | null; createdAt: string; uploadedBy: string | null; url: string | null };

export type DealDetail = {
  id: string;
  name: string;
  stage: DealStage;
  amount: number;
  currency: string;
  expectedCloseDate: string;
  probability: number;
  nextStep: string | null;
  nextStepDueDate: string | null;
  lostReason: string | null;
  closedAt: string | null;
  notes: string | null;
  companyId: string;
  companyName: string;
  primaryContactId: string | null;
  primaryContactName: string | null;
  leadId: string | null;
  createdAt: string;
  workTypes: string[];
  payment: DealPayment | null;
  sentOn: string | null;
  acceptedOn: string | null;
  staffIds: string[];
  files: DealFile[];
};

export async function getDealDetail(dealId: string): Promise<DealDetail | null> {
  const supabase = await createClient();
  const { data: deal, error } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (error) throw error;
  if (!deal) return null;

  const [{ data: company }, { data: contact }, { data: staff }, { data: files }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", deal.company_id).maybeSingle(),
    deal.primary_contact_id
      ? supabase.from("contacts").select("full_name").eq("id", deal.primary_contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("deal_staff").select("user_id").eq("deal_id", dealId),
    supabase.from("deal_files").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
  ]);

  // Signed links last an hour, long enough to open the file from the page.
  const signed = files?.length
    ? (await supabase.storage.from("proposal-files").createSignedUrls(files.map((f) => f.storage_path), 3600)).data ?? []
    : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return {
    id: deal.id,
    name: deal.name,
    stage: deal.stage,
    amount: deal.amount,
    currency: deal.currency,
    expectedCloseDate: deal.expected_close_date,
    probability: effectiveProbability(deal.stage, deal.probability),
    nextStep: deal.next_step,
    nextStepDueDate: deal.next_step_due_date,
    lostReason: deal.lost_reason,
    closedAt: deal.closed_at,
    notes: deal.notes,
    companyId: deal.company_id,
    companyName: company?.name ?? "Unknown company",
    primaryContactId: deal.primary_contact_id,
    primaryContactName: contact?.full_name ?? null,
    leadId: deal.lead_id,
    createdAt: deal.created_at,
    workTypes: deal.work_types,
    payment: deal.payment,
    sentOn: deal.sent_on,
    acceptedOn: deal.accepted_on,
    staffIds: (staff ?? []).map((s) => s.user_id),
    files: (files ?? []).map((f) => ({
      id: f.id,
      fileName: f.file_name,
      sizeBytes: f.size_bytes,
      createdAt: f.created_at,
      uploadedBy: f.uploaded_by,
      url: urlByPath.get(f.storage_path) ?? null,
    })),
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
