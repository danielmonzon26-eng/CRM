/**
 * TEMPLATE — not registered in registry.ts, does nothing on its own.
 *
 * Copy this file to build a real adapter for a JS-rendered site:
 *   1. Confirm scraping is actually allowed — check the site's Terms of Service and
 *      /robots.txt before pointing this at anything. Some sites (LinkedIn is a common
 *      example) explicitly prohibit automated scraping in their ToS; don't target
 *      those regardless of technical feasibility.
 *   2. Replace TARGET_URL, the CSS selectors, and the field mapping below with the
 *      real page's structure.
 *   3. Give it a unique `key` and add it to lib/sources/registry.ts.
 *
 * See lib/sources/calgary.ts for the plain-fetch (open data API) pattern instead —
 * only reach for Playwright when the target actually requires JS rendering.
 */
import { launchBrowser } from "./browser";
import type { FetchResult, NormalizedRecord, SourceAdapter } from "./types";

const TARGET_URL = "https://example.com/replace-with-real-target";

export const templatePlaywrightAdapter: SourceAdapter = {
  key: "template_playwright_source", // change to a unique, permanent key
  name: "TEMPLATE: replace with the real source name",
  kind: "web_scrape",

  async fetchSince(_sinceDate: string): Promise<FetchResult> {
    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });

      // Example extraction — replace `.listing-row` etc. with the real page's markup.
      const rows = await page.$$eval(".listing-row", (elements) =>
        elements.map((el) => ({
          externalId: el.getAttribute("data-id") ?? "",
          businessName: el.querySelector(".name")?.textContent?.trim() ?? "",
          address: el.querySelector(".address")?.textContent?.trim() ?? null,
        }))
      );

      const records: NormalizedRecord[] = rows
        .filter((r) => r.externalId && r.businessName)
        .map((r) => ({
          externalId: r.externalId,
          businessName: r.businessName,
          licenseType: null,
          status: null,
          issueDate: null, // this source may not expose a date at all — leave null
          address: r.address,
          community: null,
          isHomeBased: null,
          raw: r,
        }));

      return { records, truncated: false };
    } finally {
      await browser.close();
    }
  },
};
