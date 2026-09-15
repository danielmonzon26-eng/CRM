/**
 * "New and growing" scoring for Calgary companies, based on their license history.
 *
 * EDIT ME: this list has no visibility into what Catapult Ready's programs actually
 * target — it's a generic starting point. Replace with your real target verticals
 * (or broaden to score every industry equally by leaving it empty) once you know
 * which business types you want surfaced first.
 */
export const TARGET_INDUSTRIES = [
  "technology",
  "software",
  "consulting",
  "professional",
  "marketing",
  "design",
  "engineering",
];

/** Minimum score for a company to be auto-promoted into the `leads` working set. */
export const MIN_SCORE_TO_QUALIFY = 40;

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
  industry: string | null
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

  if (TARGET_INDUSTRIES.length > 0) {
    const haystack = `${industry ?? ""} ${licenses.map((l) => l.license_type ?? "").join(" ")}`.toLowerCase();
    const matched = TARGET_INDUSTRIES.find((target) => haystack.includes(target));
    if (matched) {
      score += 25;
      reasons.push({ reason: `Matches target industry "${matched}"`, points: 25 });
    }
  }

  return { score: Math.min(score, 100), reasons };
}
