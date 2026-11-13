import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeWebhook } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// Stripe calls this after a checkout completes or a payment is refunded. It authenticates by
// Stripe's signature (STRIPE_WEBHOOK_SECRET), not a user session, so it's a public path in
// middleware.ts. Set it up as described in docs/STRIPE_PAYMENTS.md.
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const event = verifyStripeWebhook(payload, request.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  const supabase = createAdminClient();
  const object = event.data.object;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (object.payment_status !== "paid") return NextResponse.json({ received: true });
    const metadata = (object.metadata ?? {}) as Record<string, string>;
    const ticketCode = metadata.ticket_code ?? (object.client_reference_id as string | undefined);
    if (!ticketCode) return NextResponse.json({ received: true });

    const { error } = await supabase
      .from("event_registrations")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: typeof object.amount_total === "number" ? object.amount_total / 100 : null,
        stripe_checkout_session_id: object.id as string,
        stripe_payment_intent_id: (object.payment_intent as string | null) ?? null,
      })
      .eq("ticket_code", ticketCode);
    // A 500 makes Stripe retry the delivery later.
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (event.type === "charge.refunded" && object.refunded === true && object.payment_intent) {
    const { error } = await supabase
      .from("event_registrations")
      .update({ payment_status: "refunded" })
      .eq("stripe_payment_intent_id", object.payment_intent as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
