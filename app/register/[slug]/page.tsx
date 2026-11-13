import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDown, CalendarDays, Clock, Lock, MapPin, MonitorPlay, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  formatEventDateLong,
  formatEventTimeRange,
  formatEventWhen,
  formatTicketPrice,
  isEventOver,
} from "@/lib/events/format";
import { isStripeEnabled, isStripeTestMode } from "@/lib/payments/stripe";
import { getRegistrationQuestions } from "@/lib/events/questions-server";
import { RegisterForm } from "./register-form";
import { PublicFooter, PublicHeader } from "./public-chrome";

export const dynamic = "force-dynamic";

const getPublicEvent = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_event", { p_slug: slug });
  if (error) throw error;
  if (data[0]) return data[0];

  // Not public, so it's a draft or doesn't exist. Signed-in team members can preview drafts,
  // and this read returns nothing for everyone else under RLS.
  const { data: draft, error: draftError } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  if (draftError) throw draftError;
  return draft ? { ...draft, spots_remaining: null } : null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.title} | Catapult`,
    description: event.description?.slice(0, 160) ?? undefined,
    openGraph: event.image_url ? { images: [event.image_url] } : undefined,
  };
}

function Fact({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="pt-0.5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-0.5 text-base font-light text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const [event, questions] = await Promise.all([getPublicEvent(slug), getRegistrationQuestions(slug)]);
  if (!event) notFound();

  const closedMessage =
    event.status === "draft"
      ? "Registration opens when this event is published."
      : event.status === "cancelled"
        ? "This event has been cancelled."
        : isEventOver(event.starts_at, event.ends_at)
          ? "This event has ended, so registration is closed."
          : event.registration_closes_at && new Date(event.registration_closes_at) < new Date()
            ? "Registration for this event has closed."
            : event.registration_opens_at && new Date(event.registration_opens_at) > new Date()
              ? `Registration opens ${formatEventWhen(event.registration_opens_at, null)}.`
              : event.spots_remaining === 0 && !event.waitlist_enabled
                ? "This event is sold out."
                : null;
  const onWaitlist = event.spots_remaining === 0 && event.waitlist_enabled;
  const isPaid = event.ticket_type === "paid" && (event.ticket_price ?? 0) > 0;
  const onlinePayment = isPaid && isStripeEnabled();
  const price = formatTicketPrice(event.ticket_type, event.ticket_price, event.currency);
  const kicker = [event.program, event.event_type].filter(Boolean).join("  ·  ");
  const lowSpots = event.spots_remaining !== null && event.spots_remaining > 0 && event.spots_remaining <= 10;

  return (
    <div className="flex min-h-screen flex-col bg-white font-light text-slate-900">
      <PublicHeader />

      {event.status === "draft" && (
        <p className="bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
          Draft preview: only your team can see this page until it&apos;s published.
        </p>
      )}

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-20 lg:pt-16">
          <div>
            {kicker && <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">{kicker}</p>}
            <h1 className="mt-4 text-4xl font-light leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
              {event.title}
            </h1>
            <p className="mt-5 text-xl font-light text-brand-600 sm:text-2xl">
              {formatEventDateLong(event.starts_at, event.ends_at)}
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Fact icon={Clock} label="Time">{formatEventTimeRange(event.starts_at, event.ends_at)}</Fact>
              {event.format !== "online" ? (
                <Fact icon={MapPin} label="Location">
                  {event.venue_name ?? "Calgary"}
                  {event.venue_address && <span className="block text-sm text-slate-500">{event.venue_address}</span>}
                </Fact>
              ) : (
                <Fact icon={MonitorPlay} label="Where">Online / livestream</Fact>
              )}
              <Fact icon={Ticket} label="Tickets">
                {price}
                {isPaid && <span className="text-sm text-slate-500"> {event.currency}</span>}
              </Fact>
              {event.format === "hybrid" && <Fact icon={MonitorPlay} label="Livestream">Join in person or online</Fact>}
            </div>

            {!closedMessage && (
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href="#register"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-brand-600 px-6 py-3.5 text-base font-normal text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  {onWaitlist ? "Join the waitlist" : "Reserve your spot"}
                  <ArrowDown className="h-4 w-4" strokeWidth={2} />
                </a>
                {lowSpots && (
                  <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-normal text-brand-700">
                    Only {event.spots_remaining} spots left
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="relative isolate">
            <div className="absolute -inset-3 -z-10 rotate-2 rounded-[34px] bg-brand-50 sm:-inset-4" aria-hidden="true" />
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt=""
                className="aspect-[4/3] w-full rounded-[28px] object-cover shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[28px] bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/catapult-logo-white.png" alt="" className="w-1/2 opacity-90" />
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-[#fafafa]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_420px] lg:gap-16 lg:py-20">
            <div className="space-y-14">
              {event.description && (
                <div>
                  <h2 className="text-3xl font-light tracking-tight text-slate-950">About this event</h2>
                  <p className="mt-5 whitespace-pre-line text-lg font-light leading-relaxed text-slate-700">{event.description}</p>
                </div>
              )}

              {event.agenda.length > 0 && (
                <div>
                  <h2 className="text-3xl font-light tracking-tight text-slate-950">Agenda</h2>
                  <ol className="mt-6 border-l border-slate-200">
                    {event.agenda.map((item, i) => (
                      <li key={i} className="relative pb-6 pl-7 last:pb-0">
                        <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-[#fafafa]" />
                        {item.time && <p className="text-sm font-normal text-brand-600">{item.time}</p>}
                        <p className="text-lg font-light text-slate-900">{item.title}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {event.speakers.length > 0 && (
                <div>
                  <h2 className="text-3xl font-light tracking-tight text-slate-950">Speakers</h2>
                  <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                    {event.speakers.map((speaker, i) => (
                      <li key={i} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-medium text-brand-700">
                          {initials(speaker.name)}
                        </span>
                        <span>
                          <span className="block font-normal text-slate-900">{speaker.name}</span>
                          {speaker.title && <span className="block text-sm text-slate-500">{speaker.title}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.14em] text-slate-400">
                  <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                  When
                </p>
                <p className="mt-2 text-lg font-light text-slate-900">{formatEventWhen(event.starts_at, event.ends_at)}</p>
              </div>
            </div>

            <aside id="register" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]">
                <div className="border-b border-slate-100 px-6 pb-5 pt-6 sm:px-8">
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">
                    {onWaitlist ? "Waitlist" : "Registration"}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <p className="text-4xl font-light tracking-tight text-slate-950">
                      {price}
                      {isPaid && <span className="ml-1.5 text-base text-slate-500">{event.currency}</span>}
                    </p>
                    {event.spots_remaining !== null && event.spots_remaining > 0 && (
                      <p className="text-sm text-slate-500">{event.spots_remaining} spots left</p>
                    )}
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  {payment === "cancelled" && !closedMessage && (
                    <p className="mb-5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900">
                      Payment wasn&apos;t completed, so your spot isn&apos;t confirmed yet. Enter the same email below to finish paying.
                    </p>
                  )}
                  {closedMessage ? (
                    <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{closedMessage}</p>
                  ) : (
                    <>
                      {onWaitlist && (
                        <p className="mb-5 rounded-xl bg-slate-100 p-3.5 text-sm text-slate-700">
                          This event is full. Join the waitlist and our team will contact you if a spot opens.
                        </p>
                      )}
                      <RegisterForm
                        slug={slug}
                        format={event.format}
                        collectCompany={event.collect_company}
                        collectPhone={event.collect_phone}
                        waitlist={onWaitlist}
                        paid={isPaid && !onWaitlist}
                        onlinePayment={onlinePayment}
                        priceLabel={price}
                        questions={questions}
                      />
                      {isPaid && !onWaitlist && (
                        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          {onlinePayment
                            ? `You'll pay securely with Stripe on the next step.${isStripeTestMode() ? " (Test mode: no real charges.)" : ""}`
                            : "Our team will follow up with you about payment after you register."}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
