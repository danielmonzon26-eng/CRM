import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, MonitorPlay, Ticket } from "lucide-react";
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
import { RegisterFlow, type FlowEvent } from "./register-flow";
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

  const whereLabel =
    event.format === "online"
      ? "Online"
      : [event.venue_name ?? "Calgary", event.venue_address].filter(Boolean).join(", ") + (event.format === "hybrid" ? " · or online" : "");
  const flowEvent: FlowEvent = {
    slug,
    title: event.title,
    whenLabel: formatEventWhen(event.starts_at, event.ends_at),
    whereLabel,
    format: event.format,
    collectCompany: event.collect_company,
    collectPhone: event.collect_phone,
    waitlist: onWaitlist,
    paid: isPaid && !onWaitlist,
    onlinePayment,
    testMode: isStripeTestMode(),
    priceLabel: price,
    currency: event.currency,
    questions,
    calendarUrl: googleCalendarUrl(event),
  };
  const mapUrl =
    event.format !== "online" && (event.venue_address || event.venue_name)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue_name, event.venue_address, "Calgary"].filter(Boolean).join(", "))}`
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-white font-light text-slate-900">
      <PublicHeader />

      {event.status === "draft" && (
        <p className="bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
          Draft preview: only your team can see this page until it&apos;s published.
        </p>
      )}

      <main className="flex-1 pb-24 lg:pb-0">
        {/* The event's image is the page's header. */}
        <div className="mx-auto max-w-6xl px-0 sm:px-8 sm:pt-6">
          <div className="relative aspect-[16/9] overflow-hidden bg-ink-900 sm:aspect-[21/8] sm:rounded-3xl">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/catapult-logo-white.png" alt="" className="w-2/5 max-w-sm opacity-90" />
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:pt-10">
          <div className="min-w-0">
            {kicker && <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">{kicker}</p>}
            <h1 className="mt-3 text-4xl font-light leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">{event.title}</h1>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Fact icon={CalendarDays} label="Date">
                {formatEventDateLong(event.starts_at, event.ends_at)}
              </Fact>
              <Fact icon={Clock} label="Time">
                {formatEventTimeRange(event.starts_at, event.ends_at)}
              </Fact>
              {event.format !== "online" ? (
                <Fact icon={MapPin} label="Location">
                  {event.venue_name ?? "Calgary"}
                  {event.venue_address && <span className="block text-sm text-slate-500">{event.venue_address}</span>}
                </Fact>
              ) : (
                <Fact icon={MonitorPlay} label="Where">Online / livestream</Fact>
              )}
              {event.format === "hybrid" && (
                <Fact icon={MonitorPlay} label="Livestream">
                  Join in person or online
                </Fact>
              )}
            </div>

            <div className="mt-12 space-y-12 border-t border-slate-100 pt-10">
              {event.description && (
                <section>
                  <h2 className="text-2xl font-light tracking-tight text-slate-950">About this event</h2>
                  <p className="mt-4 whitespace-pre-line text-lg font-light leading-relaxed text-slate-700">{event.description}</p>
                </section>
              )}

              {event.agenda.length > 0 && (
                <section>
                  <h2 className="text-2xl font-light tracking-tight text-slate-950">Agenda</h2>
                  <ol className="mt-5 border-l border-slate-200">
                    {event.agenda.map((item, i) => (
                      <li key={i} className="relative pb-6 pl-7 last:pb-0">
                        <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                        {item.time && <p className="text-sm font-normal text-brand-600">{item.time}</p>}
                        <p className="text-lg font-light text-slate-900">{item.title}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {event.speakers.length > 0 && (
                <section>
                  <h2 className="text-2xl font-light tracking-tight text-slate-950">Speakers</h2>
                  <ul className="mt-5 grid gap-4 sm:grid-cols-2">
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
                </section>
              )}

              {event.format !== "online" && (
                <section>
                  <h2 className="text-2xl font-light tracking-tight text-slate-950">Location</h2>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-5">
                    <div>
                      <p className="text-lg font-light text-slate-900">{event.venue_name ?? "Calgary"}</p>
                      {event.venue_address && <p className="text-slate-500">{event.venue_address}</p>}
                    </div>
                    {mapUrl && (
                      <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
                        <MapPin className="h-4 w-4" strokeWidth={1.75} />
                        Get directions
                      </a>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          <aside id="register" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] sm:p-7">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">{onWaitlist ? "Waitlist" : "Tickets"}</p>
              <p className="mt-2 text-4xl font-light tracking-tight text-slate-950">
                {price}
                {isPaid && <span className="ml-1.5 text-base text-slate-500">{event.currency}</span>}
              </p>
              <dl className="mt-5 space-y-2 border-t border-slate-100 pt-5 text-sm">
                <div className="flex gap-3">
                  <dt className="sr-only">When</dt>
                  <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                  <dd className="text-slate-700">{flowEvent.whenLabel}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="sr-only">Where</dt>
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                  <dd className="text-slate-700">{whereLabel}</dd>
                </div>
                {event.spots_remaining !== null && event.spots_remaining > 0 && (
                  <div className="flex gap-3">
                    <dt className="sr-only">Spots</dt>
                    <Ticket aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                    <dd className={lowSpots ? "font-normal text-brand-700" : "text-slate-700"}>
                      {lowSpots ? `Only ${event.spots_remaining} spots left` : `${event.spots_remaining} spots left`}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-6">
                {payment === "cancelled" && !closedMessage && (
                  <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900">
                    Payment wasn&apos;t completed, so your spot isn&apos;t confirmed yet. Register again with the same email to finish paying.
                  </p>
                )}
                {closedMessage ? (
                  <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{closedMessage}</p>
                ) : (
                  <>
                    {onWaitlist && <p className="mb-4 rounded-xl bg-slate-100 p-3.5 text-sm text-slate-700">This event is full. Join the waitlist and we&apos;ll contact you if a spot opens.</p>}
                    <RegisterFlow event={flowEvent} />
                    <p className="mt-3 text-center text-xs text-slate-500">Takes about a minute.</p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

/** A Google Calendar "add event" link (times in UTC). */
function googleCalendarUrl(event: { title: string; starts_at: string; ends_at: string | null; venue_name: string | null; venue_address: string | null; format: string }): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 2 * 3_600_000).toISOString();
  const location = event.format === "online" ? "Online" : [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${fmt(event.starts_at)}/${fmt(end)}`, location });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
