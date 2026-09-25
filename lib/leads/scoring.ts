/**
 * "New and growing" scoring for Calgary companies, based on their license history.
 *
 * Catapult Ready's target verticals, as keyword sets matched (case-insensitive
 * substring) against the company's `industry` (raw Calgary license type text) plus
 * every license's `license_type`. Matching is heuristic since the real Calgary
 * license-type category names haven't been confirmed against a live API response yet
 * (see README) — widen/narrow a vertical's keyword list once real values are visible
 * in `licenses.raw`.
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
  "Brick and Mortar Retail": ["retail"],
};

/** Minimum score for a company to be auto-promoted into the `leads` working set. */
export const MIN_SCORE_TO_QUALIFY = 40;

/**
 * Catapult Ready also wants $2M+ in annual revenue. Neither Calgary Open Data nor
 * Hunter.io provides company revenue, so this can't be scored automatically yet — it's
 * a manual research field a rep fills in on the lead detail page (`companies.annual_revenue_estimate`,
 * added in migration 0004). When present, it's a scoring bonus; when null (the common
 * case until someone researches it), it's neutral rather than a penalty.
 */
export const MIN_ANNUAL_REVENUE_FOR_BONUS = 2_000_000;

export type ScoreReason = { reason: string; points: number };

export type LicenseForScoring = {
  issue_date: string | null;
  license_status: string | null;
  license_type: string | null;
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
): { score: number; reasons: ScoreReason[] } {
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

  if (annualRevenueEstimate !== null && annualRevenueEstimate >= MIN_ANNUAL_REVENUE_FOR_BONUS) {
    score += 20;
    reasons.push({
      reason: `Estimated annual revenue $${annualRevenueEstimate.toLocaleString()} meets the $2M+ target`,
      points: 20,
    });
  }

  return { score: Math.min(score, 100), reasons };
}
