"use server";

import { revalidatePath } from "next/cache";
import { readIndustryCsv, type IndustryAssignment } from "@/lib/industries/import";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 900 * 1024;
const IDS_PER_UPDATE = 100;

export type IndustryPreview = {
  error?: string;
  changes: number;
  unchanged: number;
  skipped: number;
  invalid: string[];
  unknown: number;
  bySector: { sector: string; count: number }[];
};

const EMPTY: IndustryPreview = { changes: 0, unchanged: 0, skipped: 0, invalid: [], unknown: 0, bySector: [] };

async function readChanges(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "Please choose a .csv file." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over the 900 KB limit." };

  const parsed = readIndustryCsv(await file.text());
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const companies = await fetchAllPages((from, to) => supabase.from("companies").select("id, industry").range(from, to));
  const current = new Map(companies.map((c) => [c.id, c.industry]));
  const known = parsed.assignments.filter((a) => current.has(a.companyId));
  return {
    supabase,
    parsed,
    changes: known.filter((a) => current.get(a.companyId) !== a.industry),
    unchanged: known.filter((a) => current.get(a.companyId) === a.industry).length,
    unknown: parsed.assignments.length - known.length,
  };
}

/** Reads the file and reports what would change, without saving anything. */
export async function previewIndustryImport(formData: FormData): Promise<IndustryPreview> {
  const result = await readChanges(formData);
  if ("error" in result) return { ...EMPTY, error: result.error };

  const counts = new Map<string, number>();
  for (const change of result.changes) {
    const sector = change.industry.split(": ")[0];
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  return {
    changes: result.changes.length,
    unchanged: result.unchanged,
    skipped: result.parsed.skipped,
    invalid: result.parsed.invalid,
    unknown: result.unknown,
    bySector: [...counts].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count),
  };
}

/** Saves one industry at a time across its companies. Reads the file again rather than trusting the browser. */
export async function applyIndustryImport(formData: FormData): Promise<{ error?: string; updated?: number }> {
  const result = await readChanges(formData);
  if ("error" in result) return { error: result.error };
  const { supabase, changes } = result;

  const groups = new Map<string, IndustryAssignment[]>();
  for (const change of changes) groups.set(change.code, [...(groups.get(change.code) ?? []), change]);

  let updated = 0;
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += IDS_PER_UPDATE) {
      const ids = group.slice(i, i + IDS_PER_UPDATE).map((c) => c.companyId);
      const { data, error } = await supabase
        .from("companies")
        .update({ industry: group[0].industry, naics_code: group[0].code })
        .in("id", ids)
        .select("id");
      if (error) {
        revalidatePath("/companies");
        return { error: `${updated.toLocaleString()} companies saved before an error: ${error.message}. Importing the same file again finishes the rest.` };
      }
      updated += data.length;
    }
  }

  revalidatePath("/companies");
  revalidatePath("/leads");
  return { updated };
}
