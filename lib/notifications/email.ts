/**
 * Minimal client for Resend's email API (https://resend.com/docs/api-reference/emails/send-email).
 * Plain fetch rather than the `resend` SDK, matching the rest of this codebase's
 * pattern (see lib/enrichment/hunter.ts) — one less dependency for a single POST.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  if (to.length === 0) return;

  const from = process.env.DIGEST_FROM_EMAIL ?? "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Resend request failed (${res.status}): ${await res.text()}`);
  }
}
