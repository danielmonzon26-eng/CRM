"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEventVideo, createEvent, updateEvent, type EventInput } from "@/app/actions/events";
import { toDateTimeInput } from "@/lib/events/format";
import { uploadEventDocument } from "@/lib/events/upload";
import type { EventRow } from "@/lib/events/queries";

const INPUT =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200";
const LABEL = "text-xs font-medium text-slate-500";

export function EventForm({ event }: { event?: EventRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [values, setValues] = useState<EventInput>({
    title: event?.title ?? "",
    eventType: event?.event_type ?? "",
    description: event?.description ?? "",
    imageUrl: event?.image_url ?? "",
    format: event?.format ?? "in_person",
    venueName: event?.venue_name ?? "",
    venueAddress: event?.venue_address ?? "",
    onlineUrl: event?.online_url ?? "",
    startsAt: toDateTimeInput(event?.starts_at ?? null),
    endsAt: toDateTimeInput(event?.ends_at ?? null),
    capacity: event?.capacity?.toString() ?? "",
    ticketType: event?.ticket_type ?? "free",
    ticketPrice: event?.ticket_price?.toString() ?? "",
  });

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = event ? await updateEvent(event.id, values) : await createEvent(values);
          if (result.error || !result.id) {
            setError(result.error ?? "Something went wrong saving this event.");
            return;
          }

          // The event is saved by now, so a failure here is reported on its page instead of
          // staying on this form, where submitting again would create a duplicate.
          const uploadErrors = await Promise.all(files.map((file) => uploadEventDocument(result.id!, file)));
          const videoError = videoUrl.trim() ? (await addEventVideo(result.id, "", videoUrl)).error : null;
          const failed = uploadErrors.some(Boolean) || Boolean(videoError);
          router.push(`/events/${result.id}${failed ? "?notice=materials" : ""}`);
        });
      }}
    >
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700">Details</h2>
        <div>
          <label className={LABEL} htmlFor="title">Title</label>
          <input id="title" required value={values.title} onChange={(e) => set("title", e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="eventType">Event type</label>
          <input
            id="eventType"
            list="event-types"
            placeholder="e.g. Apex Forum"
            value={values.eventType}
            onChange={(e) => set("eventType", e.target.value)}
            className={INPUT}
          />
          <datalist id="event-types">
            <option value="Apex Forum" />
            <option value="Apex Summit" />
            <option value="Catapult Event" />
            <option value="Elevate IP" />
          </datalist>
        </div>
        <div>
          <label className={LABEL} htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={5}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="imageUrl">Banner image link (optional)</label>
          <input
            id="imageUrl"
            type="url"
            placeholder="https://"
            value={values.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            className={INPUT}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700">When and where</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="startsAt">Starts (Calgary time)</label>
            <input
              id="startsAt"
              type="datetime-local"
              required
              value={values.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="endsAt">Ends (Calgary time)</label>
            <input
              id="endsAt"
              type="datetime-local"
              value={values.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>
        <div>
          <label className={LABEL} htmlFor="format">Format</label>
          <select
            id="format"
            value={values.format}
            onChange={(e) => set("format", e.target.value as EventInput["format"])}
            className={INPUT}
          >
            <option value="in_person">In person</option>
            <option value="online">Online / livestream</option>
            <option value="hybrid">In person + livestream</option>
          </select>
        </div>
        {values.format !== "online" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="venueName">Venue</label>
              <input
                id="venueName"
                required
                value={values.venueName}
                onChange={(e) => set("venueName", e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="venueAddress">Address</label>
              <input
                id="venueAddress"
                value={values.venueAddress}
                onChange={(e) => set("venueAddress", e.target.value)}
                className={INPUT}
              />
            </div>
          </div>
        )}
        {values.format !== "in_person" && (
          <div>
            <label className={LABEL} htmlFor="onlineUrl">Livestream or join link</label>
            <input
              id="onlineUrl"
              type="url"
              required
              placeholder="https://"
              value={values.onlineUrl}
              onChange={(e) => set("onlineUrl", e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-slate-400">Only shown to people who register to attend online.</p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700">Tickets</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="ticketType">Ticket type</label>
            <select
              id="ticketType"
              value={values.ticketType}
              onChange={(e) => set("ticketType", e.target.value as EventInput["ticketType"])}
              className={INPUT}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {values.ticketType === "paid" && (
            <div>
              <label className={LABEL} htmlFor="ticketPrice">Price (CAD)</label>
              <input
                id="ticketPrice"
                type="number"
                min={0}
                step="0.01"
                required
                value={values.ticketPrice}
                onChange={(e) => set("ticketPrice", e.target.value)}
                className={INPUT}
              />
            </div>
          )}
          <div>
            <label className={LABEL} htmlFor="capacity">Capacity (optional)</label>
            <input
              id="capacity"
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              value={values.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>
        {values.ticketType === "paid" && (
          <p className="text-xs text-amber-700">
            Online payment isn&apos;t connected yet. People can register, and the page tells them your team will follow
            up about payment.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Materials and video</h2>
          <p className="text-xs text-slate-400">
            Optional, and you can add more any time, including after the event. Visible to your team only.
          </p>
        </div>
        <div>
          <label className={LABEL} htmlFor="materials">Upload materials (up to 50 MB each)</label>
          <input
            id="materials"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-600"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="videoUrl">Event video link</label>
          <input
            id="videoUrl"
            type="url"
            placeholder="YouTube, Vimeo, or other video link"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className={INPUT}
          />
        </div>
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : event ? "Save changes" : "Create as draft"}
      </button>
    </form>
  );
}
