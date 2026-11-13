/**
 * A person's name to show: their full name, or, when none is saved, one made from their email
 * ("daniel.monzon@…" → "Daniel Monzon"). Admins can set the real name on the Admin page.
 */
export function personName(fullName: string | null | undefined, email: string | null | undefined, fallback = "Team member"): string {
  const name = fullName?.trim();
  if (name) return name;
  const local = email?.split("@")[0]?.trim();
  if (!local) return fallback;
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
