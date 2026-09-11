/**
 * Client for the Calgary Open Data "Business Licences" dataset (Socrata/SODA API).
 *
 * Dataset: https://data.calgary.ca/Business-and-Economic-Activity/Calgary-Business-Licences/vdjc-pybd
 * Docs:    https://dev.socrata.com/foundry/data.calgary.ca/vdjc-pybd
 *
 * IMPORTANT — field names below (GETBUSID, TRADENAME, ADDRESS, COMDISTNM, LICENCETYPES,
 * FIRST_ISS_DT, JOBSTATUSDESC, ...) come from the dataset's published column list, with
 * SODA's usual convention of lowercasing them for the JSON API. This has NOT been
 * confirmed against a live API response — the sandbox this was built in can't reach
 * data.calgary.ca. Before relying on this in production, hit the endpoint once
 * (`curl "https://data.calgary.ca/resource/vdjc-pybd.json?$limit=1"`) and diff the
 * keys against CANDIDATE_FIELDS below; adjust if any are off. The raw record is always
 * stored verbatim in `licenses.raw`, so a wrong guess here loses a derived column, not
 * the underlying data — it can be re-backfilled from `raw` after fixing the mapping.
 */

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
} as const;

function pick(record: CalgaryLicenseRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export type MappedLicense = {
  externalId: string;
  businessName: string;
  licenseType: string | null;
  status: string | null;
  issueDate: string | null; // ISO date, or null if unparseable
  address: string | null;
  community: string | null;
  raw: CalgaryLicenseRecord;
};

export function mapCalgaryRecord(record: CalgaryLicenseRecord): MappedLicense | null {
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
    raw: record,
  };
}

/**
 * Fetches every record with an issue date on/after `sinceDate` (YYYY-MM-DD),
 * paginating until exhausted or MAX_PAGES_PER_CALL is hit. For daily syncs, pass a
 * date a few days in the past (not just "yesterday") so the run is resilient to the
 * source lagging or a missed cron invocation.
 */
export async function fetchCalgaryLicensesSince(
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
