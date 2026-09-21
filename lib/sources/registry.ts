import type { SourceAdapter } from "./types";
import { calgaryLicensesAdapter } from "./calgary";

/**
 * Every active data source. To add a new one:
 *   1. Implement SourceAdapter — see calgary.ts for an open-data-API example, or copy
 *      template-playwright-adapter.ts for a JS-rendered-site example.
 *   2. Add it to this array.
 * That's it — /api/cron/sync-sources auto-creates the `sources` row (keyed on
 * `adapter.key`) and runs it through the same matching/scoring pipeline as every
 * other source. No changes to the sync route, company matching, or lead scoring.
 */
export const SOURCE_ADAPTERS: SourceAdapter[] = [calgaryLicensesAdapter];
