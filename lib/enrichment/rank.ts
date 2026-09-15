import type { HunterPerson } from "./hunter";

/**
 * Priority order matches what the outreach program actually wants surfaced first:
 * decision-makers (CEO/owner/founder), then business development, then marketing,
 * then other management. Checked in order — first match wins.
 */
const TITLE_PRIORITY: { pattern: RegExp; weight: number }[] = [
  { pattern: /\b(ceo|chief executive|president|owner|founder|co-founder)\b/i, weight: 100 },
  { pattern: /\b(business development|bdm|partnerships)\b/i, weight: 80 },
  { pattern: /\b(marketing|cmo|brand)\b/i, weight: 70 },
  { pattern: /\b(director|vp|vice president|head of|manager)\b/i, weight: 50 },
];

function titleWeight(position: string | null, department: string | null, seniority: string | null): number {
  const text = `${position ?? ""} ${department ?? ""} ${seniority ?? ""}`;
  for (const { pattern, weight } of TITLE_PRIORITY) {
    if (pattern.test(text)) return weight;
  }
  return 10; // unmatched title, but still a real named contact — kept as a fallback
}

export type RankedContact = {
  fullName: string;
  title: string | null;
  email: string | null;
  emailConfidence: number | null;
  phone: string | null;
  linkedinUrl: string | null;
};

/** Filters out generic/role inboxes (info@, sales@), ranks by title priority, caps the count. */
export function rankHunterPeople(people: HunterPerson[], maxResults = 3): RankedContact[] {
  return people
    .filter((p) => p.value && p.type !== "generic")
    .map((p) => {
      const fullName =
        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
        (p.value ? p.value.split("@")[0].replace(/[._]/g, " ") : "Unknown");

      return {
        fullName,
        title: p.position,
        email: p.value,
        emailConfidence: p.confidence,
        phone: p.phone_number,
        linkedinUrl: p.linkedin,
        weight: titleWeight(p.position, p.department, p.seniority),
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxResults)
    .map(({ weight: _weight, ...contact }) => contact);
}
