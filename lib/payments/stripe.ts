import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe Checkout for paid event tickets, called over Stripe's REST API so there's no SDK
// to install. Server-only: never import this from client components, as it reads
// STRIPE_SECRET_KEY. Nothing here runs until that key is set; until then paid
// registrations are held as "unpaid" and the team follows up as before. Setup steps are in
// docs/STRIPE_PAYMENTS.md.

const STRIPE_API = "https://api.stripe.com/v1";
// Stripe signs each webhook with a timestamp; older deliveries are rejected as replays.
const WEBHOOK_TOLERANCE_SECONDS = 300;

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Test keys (sk_test_...) take card numbers like 4242 4242 4242 4242 and move no money. */
export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  metadata: Record<string, string>;
};

// Stripe takes form-encoded bodies with bracketed keys for nested objects and arrays.
function formEncode(value: unknown, prefix = "", out = new URLSearchParams()): URLSearchParams {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => formEncode(item, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) formEncode(item, prefix ? `${prefix}[${key}]` : key, out);
  } else {
    out.append(prefix, String(value));
  }
  return out;
}

async function stripeRequest<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured: STRIPE_SECRET_KEY is missing.");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: body ? formEncode(body).toString() : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Stripe ${method} ${path} failed: ${data?.error?.message ?? response.status}`);
  return data as T;
}

/** Ticket prices are stored in dollars; Stripe wants the smallest currency unit. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export async function createEventCheckoutSession(input: {
  ticketCode: string;
  eventSlug: string;
  eventTitle: string;
  eventWhen: string;
  amount: number;
  currency: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      customer_email: input.email,
      client_reference_id: input.ticketCode,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toMinorUnits(input.amount),
            product_data: { name: input.eventTitle, description: input.eventWhen },
          },
        },
      ],
      metadata: { ticket_code: input.ticketCode, event_slug: input.eventSlug },
      payment_intent_data: { metadata: { ticket_code: input.ticketCode, event_slug: input.eventSlug } },
    },
    // A double-click or retry within Stripe's idempotency window returns the same session.
    `checkout-${input.ticketCode}-${Math.floor(Date.now() / 60000)}`
  );
}

export async function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/**
 * Checks the Stripe-Signature header against STRIPE_WEBHOOK_SECRET and returns the parsed
 * event, or null when the signature is missing, wrong, or too old.
 */
export function verifyStripeWebhook(payload: string, signatureHeader: string | null): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const parts = signatureHeader.split(",").map((part) => part.split("=") as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return null;
  if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return null;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  const matches = signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return matches ? (JSON.parse(payload) as StripeEvent) : null;
}
