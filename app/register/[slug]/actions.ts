"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEventWhen } from "@/lib/events/format";
import { createEventCheckoutSession, isStripeEnabled } from "@/lib/payments/stripe";

export type RegisterInput = {
  slug: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  attendanceMode: string | null;
  website: string;
};

export type RegisterResult = {
  status:
    | "registered"
    | "waitlisted"
    | "checkout"
    | "already_registered"
    | "sold_out"
    | "closed"
    | "not_open"
    | "not_found"
    | "invalid"
    | "error";
  ticketCode?: string;
  onlineUrl?: string | null;
  confirmationMessage?: string | null;
  /** Stripe Checkout page to send the browser to when status is "checkout". */
  checkoutUrl?: string;
  /** Registered for a paid event, but payment wasn't taken online, so the team follows up. */
  paymentPending?: boolean;
};

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

// Opens a Stripe Checkout session for the registration and remembers it so the webhook can
// match the payment back. Returns null if Stripe isn't set up or the session can't be made.
async function startCheckout(
  slug: string,
  ticketCode: string,
  email: string,
  amount: number,
  currency: string
): Promise<string | null> {
  if (!isStripeEnabled()) return null;
  try {
    const supabase = await createClient();
    const { data: events } = await supabase.rpc("get_public_event", { p_slug: slug });
    const event = events?.[0];
    if (!event) return null;

    const origin = await siteOrigin();
    const session = await createEventCheckoutSession({
      ticketCode,
      eventSlug: slug,
      eventTitle: event.title,
      eventWhen: formatEventWhen(event.starts_at, event.ends_at),
      amount,
      currency,
      email,
      successUrl: `${origin}/register/${slug}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/register/${slug}?payment=cancelled#register`,
    });

    const { error } = await createAdminClient()
      .from("event_registrations")
      .update({ stripe_checkout_session_id: session.id })
      .eq("ticket_code", ticketCode);
    if (error) console.error("saving checkout session failed", error.message);

    return session.url;
  } catch (err) {
    console.error("starting Stripe checkout failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function registerForEvent(input: RegisterInput): Promise<RegisterResult> {
  // `website` is a hidden field people never see, so anything in it came from a bot.
  // It gets the normal success screen and nothing is saved.
  if (input.website) return { status: "registered" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_event", {
    p_slug: input.slug,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
    p_company: input.company,
    p_attendance_mode: input.attendanceMode,
  });
  if (error) {
    console.error("register_for_event failed", error.message);
    return { status: "error" };
  }

  // Paid tickets: a new registration, or someone coming back after leaving checkout.
  const needsPayment = (data.status === "registered" && data.payment_required) || data.status === "payment_pending";
  if (needsPayment && data.ticket_code && data.amount_due) {
    const checkoutUrl = await startCheckout(
      input.slug,
      data.ticket_code,
      input.email.trim().toLowerCase(),
      data.amount_due,
      data.currency ?? "CAD"
    );
    if (checkoutUrl) return { status: "checkout", checkoutUrl, ticketCode: data.ticket_code };
    return {
      status: "registered",
      ticketCode: data.ticket_code,
      onlineUrl: data.online_url,
      confirmationMessage: data.confirmation_message,
      paymentPending: true,
    };
  }

  // Coming back unpaid while online payment is off: their spot is already held.
  if (data.status === "payment_pending") return { status: "already_registered" };

  return {
    status: data.status,
    ticketCode: data.ticket_code,
    onlineUrl: data.online_url,
    confirmationMessage: data.confirmation_message,
  };
}
