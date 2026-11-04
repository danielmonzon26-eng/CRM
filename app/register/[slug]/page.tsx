import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, MonitorPlay, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen, formatTicketPrice, isEventOver } from "@/lib/events/format";
import { RegisterForm } from "./register-form";

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
  return { title: event ? `Register: ${event.title}` : "Event not found" };
}

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
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

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      {event.status === "draft" && (
        <p className="mx-auto mb-4 max-w-2xl rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
          Draft preview: only your team can see this page until it&apos;s published.
        </p>
      )}
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-popover">
        {event.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt="" className="max-h-72 w-full object-cover" />
        )}
        <div className="p-6 sm:p-8">
          {(event.program || event.event_type) && (
            <p className="text-sm font-medium text-brand-600">{[event.program, event.event_type].filter(Boolean).join(" · ")}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{event.title}</h1>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              {formatEventWhen(event.starts_at, event.ends_at)}
            </p>
            {event.format !== "online" && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                <span>
                  {event.venue_name}
                  {event.venue_address && <span className="block text-slate-500">{event.venue_address}</span>}
                </span>
              </p>
            )}
            {event.format !== "in_person" && (
              <p className="flex items-start gap-2">
                <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                {event.format === "online" ? "Online / livestream" : "Also available by livestream"}
              </p>
            )}
            <p className="flex items-start gap-2">
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              {formatTicketPrice(event.ticket_type, event.ticket_price, event.currency)}
              {event.spots_remaining !== null && event.spots_remaining > 0 && ` · ${event.spots_remaining} spots left`}
            </p>
          </div>

          {event.description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{event.description}</p>}

          {event.agenda.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold text-slate-900">Agenda</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {event.agenda.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    {item.time && <span className="w-24 shrink-0 text-slate-500">{item.time}</span>}
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {event.speakers.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold text-slate-900">Speakers</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {event.speakers.map((speaker, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-900">{speaker.name}</span>
                    {speaker.title && <span className="block text-slate-500">{speaker.title}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6 border-t border-slate-100 pt-6">
            {closedMessage ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">{closedMessage}</p>
            ) : (
              <>
                <h2 className="mb-3 font-semibold text-slate-900">{onWaitlist ? "Join the waitlist" : "Register"}</h2>
                {onWaitlist && (
                  <p className="mb-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                    This event is full. Join the waitlist and our team will contact you if a spot opens.
                  </p>
                )}
                {event.ticket_type === "paid" && (
                  <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Our team will follow up with you about payment after you register.
                  </p>
                )}
                <RegisterForm
                  slug={slug}
                  format={event.format}
                  collectCompany={event.collect_company}
                  collectPhone={event.collect_phone}
                  waitlist={onWaitlist}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
