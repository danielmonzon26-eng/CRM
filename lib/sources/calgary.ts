/**
 * Client for the Calgary Open Data "Business Licences" dataset (Socrata/SODA API).
 *
 * Dataset: https://data.calgary.ca/Business-and-Economic-Activity/Calgary-Business-Licences/vdjc-pybd
 * Docs:    https://dev.socrata.com/foundry/data.calgary.ca/vdjc-pybd
 *
 * Field mapping CONFIRMED against a live record on 2026-09-25 (via the GitHub Actions
 * workflow verify-calgary-fields.yml — this sandbox still can't reach data.calgary.ca
 * directly). A real record's keys: getbusid, tradename, homeoccind, address, comdistcd,
 * comdistnm, licencetypes, first_iss_dt, exp_dt, jobstatusdesc, point, globalid, plus
 * several `:@computed_region_*` geo columns not used here. Every CANDIDATE_FIELDS guess
 * below matched on its first try. The raw record is always stored verbatim in
 * `licenses.raw` regardless, so any future dataset change loses a derived column at
 * worst, not the underlying data.
 */

import type { FetchResult, NormalizedRecord, SourceAdapter } from "./types";

const DATASET_URL = "https://data.calgary.ca/resource/vdjc-pybd.json";
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_CALL = 30; // safety cap so one invocation can't run unbounded

export type CalgaryLicenseRecord = Record<string, string | undefined>;

// Each logical field lists candidate API key names, tried in order, to tolerate the
// dataset using slightly different casing/naming than expected.
const CANDIDATE_FIELDS = {
  externalId: ["getbusid", "globalid", "licencenumber", "license_number"],
  businessName: ["tradename", "businessname", "business_name"],
  licenseType: ["licencetypes", "licensetypes", "license_type"],
  status: ["jobstatusdesc", "status"],
  issueDate: ["first_iss_dt", "issueddate", "issue_date", "startdate"],
  address: ["address", "addressline1"],
  community: ["comdistnm", "comm_name", "community"],
  // "Home Occupation Indicator" -- Y means the license is for a home-based business,
  // N means a commercial/physical premises. This is Calgary's own brick-and-mortar
  // signal, more reliable than guessing from license-type keywords.
  homeOccupation: ["homeoccind"],
} as const;

function pick(record: CalgaryLicenseRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function parseHomeOccupation(value: string | null): boolean | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "Y") return true;
  if (normalized === "N") return false;
  return null;
}

export function mapCalgaryRecord(record: CalgaryLicenseRecord): NormalizedRecord | null {
  const externalId = pick(record, CANDIDATE_FIELDS.externalId);
  const businessName = pick(record, CANDIDATE_FIELDS.businessName);
  if (!externalId || !businessName) return null; // can't dedupe/display without these

  const rawIssueDate = pick(record, CANDIDATE_FIELDS.issueDate);
  const issueDate = rawIssueDate ? rawIssueDate.slice(0, 10) : null; // 'YYYY-MM-DD'

  return {
    externalId,
    businessName,
    licenseType: pick(record, CANDIDATE_FIELDS.licenseType),
    status: pick(record, CANDIDATE_FIELDS.status),
    issueDate,
    address: pick(record, CANDIDATE_FIELDS.address),
    community: pick(record, CANDIDATE_FIELDS.community),
    isHomeBased: parseHomeOccupation(pick(record, CANDIDATE_FIELDS.homeOccupation)),
    raw: record,
  };
}

/**
 * Fetches every record with an issue date on/after `sinceDate` (YYYY-MM-DD),
 * paginating until exhausted or MAX_PAGES_PER_CALL is hit. For daily syncs, pass a
 * date a few days in the past (not just "yesterday") so the run is resilient to the
 * source lagging or a missed cron invocation.
 */
async function fetchCalgaryLicensesSince(
  sinceDate: string
): Promise<{ records: CalgaryLicenseRecord[]; truncated: boolean }> {
  const appToken = process.env.CALGARY_OPEN_DATA_APP_TOKEN;
  const records: CalgaryLicenseRecord[] = [];
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES_PER_CALL; page++) {
    const params = new URLSearchParams({
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
      $order: "first_iss_dt DESC",
      $where: `first_iss_dt >= '${sinceDate}'`,
    });

    const res = await fetch(`${DATASET_URL}?${params.toString()}`, {
      headers: appToken ? { "X-App-Token": appToken } : undefined,
      // This is a cron-triggered server-side fetch; always get fresh data.
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Calgary Open Data request failed: ${res.status} ${await res.text()}`);
    }

    const batch = (await res.json()) as CalgaryLicenseRecord[];
    records.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return { records, truncated: false };
    }
    offset += PAGE_SIZE;
    if (page === MAX_PAGES_PER_CALL - 1) truncated = true;
  }

  return { records, truncated };
}

export const calgaryLicensesAdapter: SourceAdapter = {
  key: "calgary_business_licenses",
  name: "Calgary Business Licences (Open Data)",
  kind: "open_data_api",
  async fetchSince(sinceDate: string): Promise<FetchResult> {
    const { records, truncated } = await fetchCalgaryLicensesSince(sinceDate);
    const normalized = records
      .map(mapCalgaryRecord)
      .filter((r): r is NormalizedRecord => r !== null);
    return { records: normalized, truncated };
  },
};
