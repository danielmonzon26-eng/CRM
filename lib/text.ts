/** Lowercases, trims, and collapses whitespace so name matching is stable across sources. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** First letters of up to the first two words, for an avatar initial badge. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
}

/** Best-effort domain extraction from a free-form URL/website string. */
export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
