import Link from "next/link";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { getEvents, type EventListItem } from "@/lib/events/queries";
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  formatEventWhen,
  formatTicketPrice,
  isEventOver,
} from "@/lib/events/format";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await getEvents();
  const upcoming = events.filter((e) => !isEventOver(e.starts_at, e.ends_at)).reverse();
  const past = events.filter((e) => isEventOver(e.starts_at, e.ends_at));

  return (
    <Page>
      <PageHeader
        title="Events"
        subtitle="Plan, manage and measure all Catapult events."
        actions={
          <Link href="/events/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New event
          </Link>
        }
      />

      <EventSection title="Upcoming" events={upcoming} empty="No upcoming events." />
      <EventSection title="Past" events={past} empty="No past events." />
    </Page>
  );
}

function EventSection({ title, events, empty }: { title: string; events: EventListItem[]; empty: string }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700">
        {title} ({events.length})
      </h2>
      {events.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-card hover:border-brand-200"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">{event.event_type ?? "Event"}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status]}`}>
                  {STATUS_LABELS[event.status]}
                </span>
              </div>
              <p className="mt-1 font-medium text-slate-900">{event.title}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p className="flex items-start gap-1.5">
                  <CalendarDays className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                  {formatEventWhen(event.starts_at, event.ends_at)}
                </p>
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                  {event.format === "online" ? FORMAT_LABELS.online : event.venue_name}
                  {event.format === "hybrid" ? " + online" : ""}
                </p>
                <p className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                  {event.registeredCount}
                  {event.capacity ? ` of ${event.capacity}` : ""} registered ·{" "}
                  {formatTicketPrice(event.ticket_type, event.ticket_price, event.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
