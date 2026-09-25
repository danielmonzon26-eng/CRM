import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchAllPages } from "@/lib/supabase/paginate";

export type DigestLead = { id: string; companyName: string; score: number; community: string | null };

export type Digest = {
  windowDays: number;
  newLeads: DigestLead[];
  totalLeads: number;
  byStatus: Record<string, number>;
};

/** Leads promoted (created) in the last `windowDays`, plus a pipeline snapshot. */
export async function buildDailyDigest(
  supabase: SupabaseClient<Database>,
  windowDays = 1
): Promise<Digest> {
  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: newLeadRows, error: leadsError } = await supabase
    .from("leads")
    .select("id, score, company_id, created_at")
    .gte("created_at", sinceIso)
    .order("score", { ascending: false });
  if (leadsError) throw leadsError;

  const companyIds = [...new Set(newLeadRows.map((l) => l.company_id))];
  const { data: companies, error: companiesError } =
    companyIds.length > 0
      ? await supabase.from("companies").select("id, name, community").in("id", companyIds)
      : { data: [], error: null };
  if (companiesError) throw companiesError;
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));

  const newLeads: DigestLead[] = newLeadRows.map((lead) => {
    const company = companyById.get(lead.company_id);
    return {
      id: lead.id,
      companyName: company?.name ?? "Unknown company",
      score: lead.score,
      community: company?.community ?? null,
    };
  });

  const allLeads = await fetchAllPages((from, to) =>
    supabase.from("leads").select("status").range(from, to)
  );
  const byStatus: Record<string, number> = {};
  for (const lead of allLeads) {
    byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
  }

  return { windowDays, newLeads, totalLeads: allLeads.length, byStatus };
}

export function renderDigestHtml(digest: Digest, siteUrl: string): string {
  const rows = digest.newLeads
    .map(
      (lead) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(lead.companyName)}</td><td style="padding:4px 12px">${escapeHtml(
          lead.community ?? "Calgary"
        )}</td><td style="padding:4px 0">${lead.score}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family: sans-serif; color: #0f172a;">
      <h2>Calgary Lead Engine — Daily Digest</h2>
      <p>${digest.newLeads.length} new lead${digest.newLeads.length === 1 ? "" : "s"} in the last ${digest.windowDays === 1 ? "24 hours" : `${digest.windowDays} days`}. ${digest.totalLeads} total leads in the pipeline.</p>
      ${
        digest.newLeads.length > 0
          ? `<table style="border-collapse:collapse;font-size:14px"><tr style="text-align:left;color:#64748b"><th>Company</th><th>Community</th><th>Score</th></tr>${rows}</table>`
          : ""
      }
      <p style="margin-top:16px"><a href="${siteUrl}">Open the CRM</a></p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
