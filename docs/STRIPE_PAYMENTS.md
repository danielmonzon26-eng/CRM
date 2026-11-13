# Stripe payments for paid events

Paid event registrations can take payment through Stripe Checkout. The code is in place but
switched off until the keys below are set. Until then nothing changes for registrants: paid
registrations are held as **Unpaid**, the page says the team will follow up about payment,
and the team can use **Mark paid** on the event's Registrations tab.

## How it works

1. Someone fills in the registration form for a paid event.
2. `register_for_event` (migration `0031_event_payments.sql`) saves the registration with
   `payment_status = 'unpaid'` and the ticket price as `amount_due`. The spot is held.
3. The server action (`app/register/[slug]/actions.ts`) opens a Stripe Checkout session for
   that amount and sends the browser to Stripe's hosted payment page. No card details touch
   our app.
4. After paying, Stripe sends them to `/register/<slug>/confirmed`, which shows the
   confirmation and records the payment if Stripe says it's paid.
5. Stripe also calls the webhook `/api/stripe/webhook`, which marks the registration
   **Paid** (or **Refunded** after a full refund in Stripe). This is the source of truth.

If someone leaves checkout without paying, they come back to the event page with a note, and
entering the same email takes them straight back to checkout. Waitlisted people don't pay
until the team moves them into a spot.

## Setup (a Catapult admin with Stripe access)

1. **Create or open the Stripe account** for Catapult at https://dashboard.stripe.com.
   Start in **Test mode** (toggle top right).
2. **Copy the secret key**: Developers → API keys → Secret key (`sk_test_...` in test mode).
3. **Add the webhook**: Developers → Webhooks → Add endpoint.
   - Endpoint URL: `https://<your CRM domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `charge.refunded`
   - After saving, reveal the **Signing secret** (`whsec_...`).
4. **Add these to Vercel** (Project → Settings → Environment Variables, Production), then
   redeploy:

   | Name | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | the `sk_test_...` (later `sk_live_...`) key |
   | `STRIPE_WEBHOOK_SECRET` | the `whsec_...` signing secret |
   | `NEXT_PUBLIC_SITE_URL` | optional: the public site address, e.g. `https://events.catapultready.com`, if registration links use a different domain from the app |

   `SUPABASE_SERVICE_ROLE_KEY` must also be set (it already is in production), because
   payments are recorded server-side.

5. **Test it** in test mode: register for a paid TEST event and pay with card
   `4242 4242 4242 4242`, any future expiry, any CVC. The registration should show **Paid**
   on the event's Registrations tab within a few seconds, and the payment should appear in
   Stripe → Payments.
6. **Go live**: switch Stripe to live mode, create the same webhook there, and replace both
   Vercel values with the live `sk_live_...` key and its `whsec_...` secret.

## Notes

- Prices are in each event's currency (CAD by default) and come from the event's ticket price
  at the moment of registration.
- Refunds are done in Stripe. A full refund marks the registration **Refunded**; it doesn't
  cancel the registration, so cancel it on the Registrations tab if the person isn't coming.
- Payments taken outside Stripe (invoice, cash) can be recorded with **Mark paid**. Payments
  made through Stripe can't be changed from the app.
- Stripe emails a receipt when **Customer emails → Successful payments** is turned on in
  Stripe settings.
