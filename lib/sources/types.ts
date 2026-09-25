/** Shape every source adapter must normalize its data into before ingestion. */
export type NormalizedRecord = {
  externalId: string;
  businessName: string;
  licenseType: string | null;
  status: string | null;
  issueDate: string | null; // 'YYYY-MM-DD', or null if unknown/unparseable
  address: string | null;
  community: string | null;
  /** True = operates from a home address, false = commercial/physical premises, null = unknown. */
  isHomeBased: boolean | null;
  raw: Record<string, unknown>;
};

export type FetchResult = { records: NormalizedRecord[]; truncated: boolean };

/**
 * A pluggable data source. Implement this for a new target site and add it to
 * lib/sources/registry.ts — no changes to the sync route, matching, or scoring logic
 * are needed. See calgary.ts for an open-data-API example and
 * template-playwright-adapter.ts for a JS-rendered-site example.
 */
export interface SourceAdapter {
  /** Matches (or is auto-created as) the `key` column in the `sources` table. */
  key: string;
  name: string;
  kind: "open_data_api" | "web_scrape";
  fetchSince(sinceDate: string): Promise<FetchResult>;
}
