/**
 * "New and growing" scoring for Calgary companies, based on their license history.
 *
 * Catapult Ready's target verticals, as keyword sets matched (case-insensitive
 * substring) against the company's `industry` (raw Calgary `licencetypes` text) plus
 * every license's `license_type`. The FIELD name (`licencetypes`) was confirmed live on
 * 2026-09-25 (see calgary.ts), but only one example value has actually been seen
 * ("MOTOR VEHICLE DEALER - PREMISES") — the full vocabulary Calgary uses for this field
 * across categories is still unconfirmed, so these keyword lists remain an educated
 * guess. Widen/narrow a vertical's keywords once more real values are visible in
 * `licenses.raw` (e.g. after the first live sync runs).
 */
export const TARGET_INDUSTRIES: Record<string, string[]> = {
  Manufacturing: ["manufactur"],
  Agriculture: ["agricultur", "agri-food", "agri food", "farm", "ranch"],
  "E-commerce": ["e-commerce", "ecommerce", "online retail", "online store"],
  "Oil & Gas Service": ["oil", "gas", "petroleum", "oilfield", "oil field", "drilling"],
  Trades: [
    "electrical",
    "plumbing",
    "hvac",
    "welding",
    "mechanical contractor",
    "general contractor",
    "construction",
  ],
  Defence: ["defence", "defense", "aerospace", "military"],
  Packaging: ["packaging", "packing"],
};

/**
 * "Brick and mortar" bonus: unlike the keyword-matched verticals above, Calgary's
 * dataset carries a real, confirmed field for this -- `homeoccind` ("Home Occupation
 * Indicator", Y/N), mapped onto `licenses.is_home_based`. false/N means the license is
 * for a commercial/physical premises rather than a home-based business, which is a
 * far more reliable brick-and-mortar signal than guessing from keywords like "retail"
 * (a manufacturer or oil & gas service shop is brick-and-mortar too, just not retail).
 */
export const BRICK_AND_MORTAR_BONUS_POINTS = 15;

/** Minimum score for a company to be auto-promoted into the `leads` working set. */
export const MIN_SCORE_TO_QUALIFY = 40;

/**
 * Catapult Ready requires $2M+ in annual revenue. Neither Calgary Open Data nor
 * Hunter.io provides company revenue, so it can't be known at ingestion time — it's a
 * manual research field a rep fills in on the lead detail page
 * (`companies.estimated_annual_revenue`, added in migration 0004).
 *
 * This is a hard requirement, not just a scoring bonus: once a rep records a figure
 * below this threshold, the company is disqualified (score forced to 0, so it can
 * never cross MIN_SCORE_TO_QUALIFY) regardless of how strong its other signals are.
 * Until it's researched (null), there's nothing to gate on, so revenue stays neutral —
 * a newly-ingested company is still scored/promoted on its other signals as before.
 * This is an explicit, revisitable choice (the user may want a softer bonus again, or
 * to also auto-move an already-promoted lead to "unqualified" once disqualified this
 * way — currently it doesn't, see README) — not a fixed rule to build further logic on
 * without checking back in.
 */
export const MIN_ANNUAL_REVENUE_TO_QUALIFY = 2_000_000;

export type ScoreReason = { reason: string; points: number };

export type LicenseForScoring = {
  issue_date: string | null;
  license_status: string | null;
  license_type: string | null;
  is_home_based: boolean | null;
};

function daysAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Scores a company 0-100 from its license records. Signals:
 *  - Recency of most recent license issue date (newer = stronger "new business" signal)
 *  - At least one currently active/licensed record
 *  - Multiple license records over time (renewal, added license type, expansion — a
 *    rough proxy for "growing" vs. a single one-off registration)
 *  - Industry/license-type match against TARGET_INDUSTRIES
 */
export function scoreCompany(
  licenses: LicenseForScoring[],
  industry: string | null,
  annualRevenueEstimate: number | null = null
): { score: number; reasons: ScoreReason[]; disqualified: boolean } {
  const reasons: ScoreReason[] = [];
  let score = 0;

  const mostRecentIssueDate = licenses
    .map((l) => l.issue_date)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  if (mostRecentIssueDate) {
    const age = daysAgo(mostRecentIssueDate);
    if (age <= 30) {
      score += 40;
      reasons.push({ reason: `License issued ${age} day(s) ago`, points: 40 });
    } else if (age <= 90) {
      score += 25;
      reasons.push({ reason: `License issued ${age} day(s) ago`, points: 25 });
    } else if (age <= 180) {
      score += 10;
      reasons.push({ reason: `License issued ${age} day(s) ago`, points: 10 });
    }
  }

  const hasActiveLicense = licenses.some((l) => {
    const status = (l.license_status ?? "").toUpperCase();
    return status.includes("LICENSED") && !status.includes("EXPIRED") && !status.includes("CANCEL");
  });
  if (hasActiveLicense) {
    score += 20;
    reasons.push({ reason: "Has an active license", points: 20 });
  }

  if (licenses.length >= 2) {
    score += 15;
    reasons.push({ reason: `${licenses.length} license records on file (growth signal)`, points: 15 });
  }

  const haystack = `${industry ?? ""} ${licenses.map((l) => l.license_type ?? "").join(" ")}`.toLowerCase();
  for (const [vertical, keywords] of Object.entries(TARGET_INDUSTRIES)) {
    const hit = keywords.find((keyword) => haystack.includes(keyword));
    if (hit) {
      score += 25;
      reasons.push({ reason: `Matches target industry "${vertical}" (keyword "${hit}")`, points: 25 });
      break; // only credit one vertical match even if the text hits more than one
    }
  }

  const hasPhysicalPremises = licenses.some((l) => l.is_home_based === false);
  if (hasPhysicalPremises) {
    score += BRICK_AND_MORTAR_BONUS_POINTS;
    reasons.push({
      reason: "Operates from a commercial/physical premises, not home-based (brick and mortar)",
      points: BRICK_AND_MORTAR_BONUS_POINTS,
    });
  }

  if (annualRevenueEstimate !== null) {
    if (annualRevenueEstimate >= MIN_ANNUAL_REVENUE_TO_QUALIFY) {
      score += 20;
      reasons.push({
        reason: `Estimated annual revenue $${annualRevenueEstimate.toLocaleString()} meets the $2M+ target`,
        points: 20,
      });
    } else {
      reasons.push({
        reason: `Disqualified: estimated annual revenue $${annualRevenueEstimate.toLocaleString()} is below the $2M+ target`,
        points: -score,
      });
      return { score: 0, reasons, disqualified: true };
    }
  }

  return { score: Math.min(score, 100), reasons, disqualified: false };
}
