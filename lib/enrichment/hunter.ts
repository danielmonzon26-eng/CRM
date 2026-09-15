/**
 * Client for Hunter.io's Domain Search API.
 * Docs: https://hunter.io/api-documentation/v2#domain-search
 *
 * Domain Search accepts either a known `domain` or a bare `company` name — when given
 * a name, Hunter resolves the domain itself, which is what lets this pipeline work
 * without a separate company-website-lookup step. If a domain does get resolved, the
 * caller should persist it onto the company row so future runs skip straight to it.
 */

const HUNTER_BASE = "https://api.hunter.io/v2";

export type HunterPerson = {
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  value: string | null; // email address
  confidence: number | null; // 0-100
  phone_number: string | null;
  linkedin: string | null;
  type: "personal" | "generic" | null;
};

type HunterDomainSearchResponse = {
  data?: {
    domain: string | null;
    emails: HunterPerson[];
  };
  errors?: { id: string; code: number; details: string }[];
};

export async function hunterDomainSearch(
  params: { domain: string } | { company: string }
): Promise<{ domain: string | null; people: HunterPerson[] }> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY not set");

  const query = new URLSearchParams({ api_key: apiKey, limit: "10" });
  if ("domain" in params) query.set("domain", params.domain);
  else query.set("company", params.company);

  const res = await fetch(`${HUNTER_BASE}/domain-search?${query.toString()}`, { cache: "no-store" });
  const body = (await res.json()) as HunterDomainSearchResponse;

  if (!res.ok) {
    const detail = body.errors?.[0]?.details ?? res.statusText;
    throw new Error(`Hunter.io domain-search failed (${res.status}): ${detail}`);
  }

  return {
    domain: body.data?.domain ?? null,
    people: body.data?.emails ?? [],
  };
}
