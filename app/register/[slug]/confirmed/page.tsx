import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEventWhen } from "@/lib/events/format";
import { isStripeEnabled, retrieveCheckoutSession, type CheckoutSession } from "@/lib/payments/stripe";
import { PublicFooter, PublicHeader } from "../public-chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Registration confirmed | Catapult" };

// Stripe sends people here after checkout. The webhook is what records the payment; this page
// also records it when Stripe confirms the session is paid, so the team sees it straight away
// even if the webhook is slow. Both updates are the same, so running twice is harmless.
async function confirmSession(slug: string, sessionId: string): Promise<CheckoutSession | null> {
  if (!isStripeEnabled() || !sessionId.startsWith("cs_")) return null;
  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.metadata?.event_slug !== slug) return null;
    if (session.payment_status === "paid" && session.metadata.ticket_code) {
      await createAdminClient()
        .from("event_registrations")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          amount_paid: session.amount_total != null ? session.amount_total / 100 : null,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
        })
        .eq("ticket_code", session.metadata.ticket_code)
        .neq("payment_status", "paid");
    }
    return session;
  } catch (err) {
    console.error("confirming Stripe session failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_event", { p_slug: slug });
  const event = data?.[0];
  if (!event) notFound();

  const session = sessionId ? await confirmSession(slug, sessionId) : null;
  const paid = session?.payment_status === "paid";
  const ticket = session?.metadata?.ticket_code;
  const amount =
    paid && session?.amount_total != null && session.currency
      ? new Intl.NumberFormat("en-CA", { style: "currency", currency: session.currency.toUpperCase() }).format(session.amount_total / 100)
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-white font-light text-slate-900">
      <PublicHeader />
      <main className="flex-1 bg-[#fafafa]">
        <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]">
            {event.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.image_url} alt="" className="h-48 w-full object-cover sm:h-56" />
            )}
            <div className="p-7 sm:p-10">
              {paid || !sessionId ? (
                <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.14em] text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  {paid ? "Payment received" : "You're registered"}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.14em] text-amber-600">
                  <Clock3 className="h-4 w-4" strokeWidth={2} />
                  Confirming your payment
                </p>
              )}
              <h1 className="mt-3 text-3xl font-light leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {paid ? "You're all set. See you there." : sessionId ? "We're confirming your payment." : "See you there."}
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                {paid
                  ? `Your spot at ${event.title} is confirmed${amount ? ` and we've received your payment of ${amount}` : ""}. Stripe will email your receipt.`
                  : sessionId
                    ? "This usually takes a moment. Your spot is held, and our team will contact you if anything needs attention."
                    : `Your spot at ${event.title} is saved.`}
              </p>

              <div className="mt-8 space-y-3 rounded-2xl bg-slate-50 p-5 text-base">
                <p className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
                  {formatEventWhen(event.starts_at, event.ends_at)}
                </p>
                {event.format !== "online" && event.venue_name && (
                  <p className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
                    <span>
                      {event.venue_name}
                      {event.venue_address && <span className="block text-sm text-slate-500">{event.venue_address}</span>}
                    </span>
                  </p>
                )}
              </div>

              {ticket && (
                <p className="mt-6 text-sm text-slate-500">
                  Your ticket number: <span className="font-mono text-base text-slate-900">{ticket.slice(0, 8).toUpperCase()}</span>
                </p>
              )}

              <a
                href={`/register/${slug}`}
                className="mt-8 inline-flex rounded-[10px] border border-slate-300 px-5 py-3 text-sm font-normal text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
              >
                Back to the event page
              </a>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
