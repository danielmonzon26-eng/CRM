import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ExternalLink, Pencil } from "lucide-react";
import { getEventDetail } from "@/lib/events/queries";
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  formatEventWhen,
  formatTicketPrice,
  getVideoEmbedUrl,
  isEventOver,
} from "@/lib/events/format";
import { getSiteUrl } from "@/lib/site-url";
import {
  CopyLinkButton,
  DocumentRow,
  DocumentUpload,
  EventStatusButtons,
  RegistrationActions,
  RemoveResourceButton,
  VideoForm,
} from "./event-controls";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const { event, registrations, documents, videos } = detail;
  const active = registrations.filter((r) => r.status === "registered");
  const checkedIn = active.filter((r) => r.checked_in_at).length;
  const online = active.filter((r) => r.attendance_mode === "online").length;
  const registrationUrl = `${await getSiteUrl()}/register/${event.slug}`;
  const isOver = isEventOver(event.starts_at, event.ends_at);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>

      {notice === "materials" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The event was saved, but some materials or the video link didn&apos;t save. Please add them again below.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-400">{event.event_type ?? "Event"}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
          </div>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{event.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatEventWhen(event.starts_at, event.ends_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/register/${event.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            View landing page
          </a>
          <Link
            href={`/events/${event.id}/edit`}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            Edit
          </Link>
          <EventStatusButtons eventId={event.id} status={event.status} />
        </div>
      </div>

      {event.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image_url} alt="" className="mt-5 max-h-64 w-full rounded-xl object-cover" />
      )}

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700">Landing page link</h2>
        {event.status === "published" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{registrationUrl}</code>
            <CopyLinkButton url={registrationUrl} />
            <a
              href={registrationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              Open
            </a>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            {event.status === "draft"
              ? "Only your team can see the landing page while this is a draft. Publish to share it and open registration."
              : "This event is cancelled, so its page no longer takes registrations."}
          </p>
        )}
        {event.status === "published" && isOver && (
          <p className="mt-2 text-xs text-slate-500">This event has ended, so its page no longer takes registrations.</p>
        )}
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered" value={event.capacity ? `${active.length} of ${event.capacity}` : String(active.length)} />
        <Stat label="Checked in" value={String(checkedIn)} />
        <Stat label="Attending" value={event.format === "hybrid" ? `${active.length - online} in person, ${online} online` : FORMAT_LABELS[event.format]} />
        <Stat label="Ticket" value={formatTicketPrice(event.ticket_type, event.ticket_price, event.currency)} />
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {event.format !== "online" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-card">
            <h2 className="font-semibold text-slate-700">Venue</h2>
            <p className="mt-1 text-slate-900">{event.venue_name}</p>
            {event.venue_address && <p className="text-slate-500">{event.venue_address}</p>}
          </div>
        )}
        {event.format !== "in_person" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-card">
            <h2 className="font-semibold text-slate-700">Livestream or join link</h2>
            {event.online_url && (
              <a href={event.online_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-brand-600 hover:underline">
                {event.online_url}
              </a>
            )}
          </div>
        )}
        {event.description && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-card md:col-span-2">
            <h2 className="font-semibold text-slate-700">Description</h2>
            <p className="mt-1 whitespace-pre-line text-slate-600">{event.description}</p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">Registrations ({active.length})</h2>
        {registrations.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No registrations yet.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Attending</th>
                  <th className="px-3 py-2 font-medium">Registered</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((r) => (
                  <tr key={r.id} className={r.status === "cancelled" ? "text-slate-400" : "text-slate-700"}>
                    <td className="px-3 py-2 font-medium">
                      {r.lead_id ? (
                        <Link href={`/leads/${r.lead_id}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                          {r.full_name}
                          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                        </Link>
                      ) : (
                        r.full_name
                      )}
                      {r.status === "cancelled" && <span className="ml-1.5 text-xs font-normal">(cancelled)</span>}
                    </td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.company_name ?? "—"}</td>
                    <td className="px-3 py-2">{FORMAT_LABELS[r.attendance_mode]}</td>
                    <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleDateString("en-CA")}</td>
                    <td className="px-3 py-2">
                      <RegistrationActions
                        registrationId={r.id}
                        eventId={event.id}
                        cancelled={r.status === "cancelled"}
                        checkedIn={Boolean(r.checked_in_at)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Materials ({documents.length})</h2>
          <DocumentUpload eventId={event.id} />
        </div>
        <p className="mt-1 text-xs text-slate-400">Visible to your team only. Up to 50 MB per file.</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {documents.map((d) => (
            <DocumentRow key={d.id} id={d.id} eventId={event.id} title={d.title} downloadUrl={d.downloadUrl} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">Event videos ({videos.length})</h2>
        <p className="mt-1 text-xs text-slate-400">Visible to your team only.</p>
        <div className="mt-2">
          <VideoForm eventId={event.id} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {videos.map((v) => {
            const embedUrl = getVideoEmbedUrl(v.url!);
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <a href={v.url!} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm font-medium text-brand-600 hover:underline">
                    {v.title}
                  </a>
                  <RemoveResourceButton id={v.id} eventId={event.id} label={v.title} />
                </div>
                {embedUrl && (
                  <iframe
                    src={embedUrl}
                    title={v.title}
                    allowFullScreen
                    loading="lazy"
                    className="mt-2 aspect-video w-full rounded-lg border-0"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value}</p>
    </div>
  );
}
