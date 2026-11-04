"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Plus, Trash2 } from "lucide-react";
import { saveEvent, saveEventTemplate, setEventStatus } from "@/app/actions/events";
import { DocumentUpload, VideoForm } from "@/app/(app)/events/[id]/event-controls";
import { buttonClass } from "@/components/ui/button";
import { FORMAT_LABELS, formatEventWhen, fromDateTimeInput, toDateTimeInput } from "@/lib/events/format";
import type { EventRow, EventTemplate } from "@/lib/events/queries";
import { uploadEventBanner } from "@/lib/events/upload";
import { getMissingForPublish, type EventInput } from "@/lib/events/validation";

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "text-sm font-medium text-slate-700";
const CARD = "space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card";
const AUTOSAVE_DELAY_MS = 1500;

const STEPS = ["Details", "Schedule", "Registration", "Budget", "Review"];
const PROGRAMS = ["Apex Forum", "Apex Summit", "Catapult Event", "Elevate IP"];

function toInput(event?: EventRow): EventInput {
  return {
    title: event?.title ?? "",
    program: event?.program ?? "",
    eventType: event?.event_type ?? "",
    description: event?.description ?? "",
    imageUrl: event?.image_url ?? "",
    ownerId: event?.owner_id ?? "",
    startsAt: toDateTimeInput(event?.starts_at ?? null),
    endsAt: toDateTimeInput(event?.ends_at ?? null),
    format: event?.format ?? "in_person",
    venueName: event?.venue_name ?? "",
    venueAddress: event?.venue_address ?? "",
    onlineUrl: event?.online_url ?? "",
    agenda: event?.agenda ?? [],
    speakers: event?.speakers ?? [],
    ticketType: event?.ticket_type ?? "free",
    ticketPrice: event?.ticket_price?.toString() ?? "",
    capacity: event?.capacity?.toString() ?? "",
    collectCompany: event?.collect_company ?? true,
    collectPhone: event?.collect_phone ?? true,
    waitlistEnabled: event?.waitlist_enabled ?? false,
    registrationOpensAt: toDateTimeInput(event?.registration_opens_at ?? null),
    registrationClosesAt: toDateTimeInput(event?.registration_closes_at ?? null),
    confirmationMessage: event?.confirmation_message ?? "",
    budgetAmount: event?.budget_amount?.toString() ?? "",
    fundingSource: event?.funding_source ?? "",
    budgetNotes: event?.budget_notes ?? "",
  };
}

export function EventWizard({
  event,
  members,
  templates,
  materials = [],
  videos = [],
  initialStep = 0,
  initialStart = "",
}: {
  event?: EventRow;
  initialStep?: number;
  initialStart?: string;
  members: { id: string; name: string }[];
  templates: EventTemplate[];
  materials?: string[];
  videos?: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<EventInput>(() => ({ ...toInput(event), startsAt: event ? toDateTimeInput(event.starts_at) : initialStart }));
  const [step, setStep] = useState(initialStep);
  const [eventId, setEventId] = useState<string | null>(event?.id ?? null);
  const [slug, setSlug] = useState(event?.slug ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [materialNames, setMaterialNames] = useState(materials);
  const [videoLinks, setVideoLinks] = useState(videos);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateNote, setTemplateNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = event?.status ?? "draft";
  const autosaves = status === "draft";
  const missing = useMemo(() => getMissingForPublish(values), [values]);

  // Saves run one at a time, so an autosave and a button click can't both create the event.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const idRef = useRef(eventId);
  const lastSaved = useRef(JSON.stringify(values));

  const save = useCallback((input: EventInput) => {
    const run = queue.current.then(async () => {
      const result = await saveEvent(idRef.current, input);
      if (result.id && !idRef.current) {
        idRef.current = result.id;
        setEventId(result.id);
        setSlug(result.slug ?? null);
        // Updates the address without a navigation, so typing and focus aren't interrupted.
        window.history.replaceState(null, "", `/events/${result.id}/edit`);
      }
      if (!result.error) lastSaved.current = JSON.stringify(input);
      return result;
    });
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  useEffect(() => {
    if (!autosaves || !values.title.trim() || !values.startsAt) return;
    if (JSON.stringify(values) === lastSaved.current) return;

    const handle = setTimeout(async () => {
      setSaveNote("Saving...");
      try {
        const result = await save(values);
        setSaveNote(result.error ? `Not saved: ${result.error}` : "Draft saved");
      } catch {
        setSaveNote("Not saved. Check your connection.");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(handle);
  }, [values, autosaves, save]);

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function validateStep(index: number): string | null {
    if (index === 0 && !values.title.trim()) return "Add an event name to continue.";
    if (index === 1) {
      if (!values.startsAt) return "Add a start date and time to continue.";
      if (values.endsAt && fromDateTimeInput(values.endsAt) < fromDateTimeInput(values.startsAt)) {
        return "The end time must be after the start time.";
      }
    }
    return null;
  }

  function goTo(index: number) {
    for (let i = step; i < index; i++) {
      const problem = validateStep(i);
      if (problem) {
        setStep(i);
        setError(problem);
        return;
      }
    }
    setError(null);
    setStep(index);
    window.scrollTo({ top: 0 });
  }

  function saveAndExit() {
    setError(null);
    startTransition(async () => {
      const result = await save(values);
      if (result.error || !result.id) setError(result.error ?? "Something went wrong saving this event.");
      else router.push(`/events/${result.id}`);
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await save(values);
      if (result.error || !result.id) {
        setError(result.error ?? "Something went wrong saving this event.");
        return;
      }
      const published = await setEventStatus(result.id, "published");
      if (published.error) setError(published.error);
      else router.push(`/events/${result.id}`);
    });
  }

  function applyTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setValues((current) => ({
      ...current,
      ...(template.data as Partial<EventInput>),
      title: current.title || ((template.data as Partial<EventInput>).title ?? ""),
    }));
  }

  async function chooseBanner(file: File) {
    setBannerError(null);
    setIsUploadingBanner(true);
    const result = await uploadEventBanner(file);
    if (result.url) set("imageUrl", result.url);
    else setBannerError(result.error ?? "That image couldn't be uploaded.");
    setIsUploadingBanner(false);
  }

  return (
    <div>
      <ol className="mb-6 flex items-start rounded-xl border border-slate-200 bg-white px-3 py-4 shadow-card sm:px-6">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <span className={`absolute right-1/2 top-4 h-px w-full ${done || current ? "bg-brand-600" : "bg-slate-200"}`} aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={current ? "step" : undefined}
                className="relative flex flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    current
                      ? "bg-brand-600 text-white"
                      : done
                        ? "border-2 border-brand-600 bg-white text-brand-600"
                        : "border border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className={`text-xs sm:text-sm ${current ? "font-semibold text-slate-900" : "text-slate-500"}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {step === 0 && (
            <section className={CARD}>
              <h2 className="text-lg font-semibold text-slate-900">Event details</h2>
              <div>
                <label className={LABEL} htmlFor="title">Event name <span className="text-brand-600">*</span></label>
                <input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} className={INPUT} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="program">Program</label>
                  <input id="program" list="programs" placeholder="e.g. Apex Forum" value={values.program} onChange={(e) => set("program", e.target.value)} className={INPUT} />
                  <datalist id="programs">{PROGRAMS.map((p) => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <label className={LABEL} htmlFor="eventType">Event type</label>
                  <input id="eventType" placeholder="e.g. Workshop or breakfast" value={values.eventType} onChange={(e) => set("eventType", e.target.value)} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="ownerId">Event owner</label>
                <select id="ownerId" value={values.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={INPUT}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="description">Description</label>
                <textarea id="description" rows={5} value={values.description} onChange={(e) => set("description", e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL} htmlFor="banner">Banner</label>
                {values.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={values.imageUrl} alt="" className="mt-2 max-h-40 w-full rounded-lg object-cover" />
                )}
                <input
                  id="banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isUploadingBanner}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void chooseBanner(file);
                  }}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {isUploadingBanner ? "Uploading..." : "JPG, PNG, or WebP, up to 5 MB. Or paste an image link:"}
                </p>
                {bannerError && <p className="mt-1 text-sm text-rose-700">{bannerError}</p>}
                <input
                  type="url"
                  aria-label="Banner image link"
                  placeholder="https://"
                  value={values.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  className={INPUT}
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className={CARD}>
              <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="startsAt">Starts <span className="text-brand-600">*</span></label>
                  <input id="startsAt" type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="endsAt">Ends</label>
                  <input id="endsAt" type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={INPUT} />
                </div>
              </div>
              <p className="text-xs text-slate-500">Times are in Calgary time.</p>
              <div>
                <label className={LABEL} htmlFor="format">Format</label>
                <select id="format" value={values.format} onChange={(e) => set("format", e.target.value as EventInput["format"])} className={INPUT}>
                  <option value="in_person">In person</option>
                  <option value="online">Online / livestream</option>
                  <option value="hybrid">In person + livestream</option>
                </select>
              </div>
              {values.format !== "online" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor="venueName">Venue</label>
                    <input id="venueName" value={values.venueName} onChange={(e) => set("venueName", e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="venueAddress">Address</label>
                    <input id="venueAddress" value={values.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} className={INPUT} />
                  </div>
                </div>
              )}
              {values.format !== "in_person" && (
                <div>
                  <label className={LABEL} htmlFor="onlineUrl">Livestream or join link</label>
                  <input id="onlineUrl" type="url" placeholder="https://" value={values.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} className={INPUT} />
                  <p className="mt-1 text-xs text-slate-500">Only shown to people who register to attend online.</p>
                </div>
              )}

              <Repeater
                title="Agenda"
                addLabel="Add agenda item"
                rows={values.agenda.map((a) => [a.time, a.title])}
                placeholders={["10:00 a.m.", "Session title"]}
                onChange={(rows) => set("agenda", rows.map(([time, title]) => ({ time, title })))}
              />
              <Repeater
                title="Speakers"
                addLabel="Add speaker"
                rows={values.speakers.map((s) => [s.name, s.title])}
                placeholders={["Name", "Title and organization"]}
                onChange={(rows) => set("speakers", rows.map(([name, title]) => ({ name, title })))}
              />
            </section>
          )}

          {step === 2 && (
            <section className={CARD}>
              <h2 className="text-lg font-semibold text-slate-900">Registration</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={LABEL} htmlFor="ticketType">Ticket type</label>
                  <select id="ticketType" value={values.ticketType} onChange={(e) => set("ticketType", e.target.value as EventInput["ticketType"])} className={INPUT}>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                {values.ticketType === "paid" && (
                  <div>
                    <label className={LABEL} htmlFor="ticketPrice">Price (CAD)</label>
                    <input id="ticketPrice" type="number" min={0} step="0.01" value={values.ticketPrice} onChange={(e) => set("ticketPrice", e.target.value)} className={INPUT} />
                  </div>
                )}
                <div>
                  <label className={LABEL} htmlFor="capacity">Capacity</label>
                  <input id="capacity" type="number" min={1} step={1} placeholder="Unlimited" value={values.capacity} onChange={(e) => set("capacity", e.target.value)} className={INPUT} />
                </div>
              </div>
              {values.ticketType === "paid" && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Online payment isn&apos;t connected yet. People can register, and the page tells them your team will follow up about payment.
                </p>
              )}
              <fieldset>
                <legend className={LABEL}>Registration fields</legend>
                <p className="text-xs text-slate-500">Name and email are always collected.</p>
                <Checkbox label="Ask for company" checked={values.collectCompany} onChange={(v) => set("collectCompany", v)} />
                <Checkbox label="Ask for phone number" checked={values.collectPhone} onChange={(v) => set("collectPhone", v)} />
              </fieldset>
              <Checkbox
                label="Offer a waitlist when the event is full"
                checked={values.waitlistEnabled}
                onChange={(v) => set("waitlistEnabled", v)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="registrationOpensAt">Registration opens</label>
                  <input id="registrationOpensAt" type="datetime-local" value={values.registrationOpensAt} onChange={(e) => set("registrationOpensAt", e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="registrationClosesAt">Registration closes</label>
                  <input id="registrationClosesAt" type="datetime-local" value={values.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} className={INPUT} />
                </div>
              </div>
              <p className="-mt-2 text-xs text-slate-500">Leave blank to open on publish and close when the event ends.</p>
              <div>
                <label className={LABEL} htmlFor="confirmationMessage">Confirmation message</label>
                <textarea
                  id="confirmationMessage"
                  rows={3}
                  placeholder="Shown after someone registers"
                  value={values.confirmationMessage}
                  onChange={(e) => set("confirmationMessage", e.target.value)}
                  className={INPUT}
                />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className={CARD}>
              <h2 className="text-lg font-semibold text-slate-900">Budget</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="budgetAmount">Budget allocation (CAD)</label>
                  <input id="budgetAmount" type="number" min={0} step="0.01" value={values.budgetAmount} onChange={(e) => set("budgetAmount", e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="fundingSource">Funding source</label>
                  <input id="fundingSource" value={values.fundingSource} onChange={(e) => set("fundingSource", e.target.value)} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="budgetNotes">Budget notes</label>
                <textarea id="budgetNotes" rows={4} value={values.budgetNotes} onChange={(e) => set("budgetNotes", e.target.value)} className={INPUT} />
              </div>
              <p className="text-xs text-slate-500">
                If this event is linked to a line on the Budgets page, that line's amount and expenses are used in reports instead.
              </p>
            </section>
          )}

          {step === 4 && (
            <>
              <section className={CARD}>
                <h2 className="text-lg font-semibold text-slate-900">Review</h2>
                {missing.length > 0 ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-2 font-medium">
                      <AlertCircle className="h-4 w-4" strokeWidth={2} />
                      Needed before publishing
                    </p>
                    <ul className="mt-1 list-disc pl-6">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    Ready to publish
                  </p>
                )}
                <SummaryList values={values} members={members} />
                {eventId && slug && (
                  <a href={`/register/${slug}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                    <ExternalLink className="h-4 w-4" strokeWidth={2} />
                    Preview landing page
                  </a>
                )}
              </section>

              <section className={CARD}>
                <div>
                  <h2 className="font-semibold text-slate-900">Materials and video</h2>
                  <p className="text-xs text-slate-500">
                    Optional, and you can add more any time, including after the event. Visible to your team only.
                  </p>
                </div>
                {eventId ? (
                  <>
                    <DocumentUpload eventId={eventId} onUploaded={(name) => setMaterialNames((c) => [...c, name])} />
                    {materialNames.length > 0 && (
                      <ul className="text-sm text-slate-600">{materialNames.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ul>
                    )}
                    <VideoForm eventId={eventId} onAdded={(url) => setVideoLinks((c) => [...c, url])} />
                    {videoLinks.length > 0 && (
                      <ul className="break-all text-sm text-slate-600">{videoLinks.map((v, i) => <li key={`${v}-${i}`}>{v}</li>)}</ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Available once the event has a name and start time.</p>
                )}
              </section>

              <section className={CARD}>
                <div>
                  <h2 className="font-semibold text-slate-900">Save as a template</h2>
                  <p className="text-xs text-slate-500">Reuse this plan for future events. Dates aren&apos;t included.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input aria-label="Template name" placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className={`${INPUT} mt-0`} />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await saveEventTemplate(templateName, values);
                        setTemplateNote(result.error ?? "Template saved");
                        if (!result.error) setTemplateName("");
                      })
                    }
                    className={`${buttonClass("secondary")} shrink-0`}
                  >
                    Save template
                  </button>
                </div>
                {templateNote && <p className="text-sm text-slate-600">{templateNote}</p>}
              </section>
            </>
          )}

          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={() => goTo(step - 1)} className={buttonClass("ghost")}>
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Back
                </button>
              )}
              <button type="button" disabled={isPending} onClick={saveAndExit} className={buttonClass("secondary")}>
                {status === "draft" ? "Save draft" : "Save changes"}
              </button>
              <span aria-live="polite" className="text-xs text-slate-500">
                {saveNote ?? (autosaves ? "Autosaves once it has a name and start time" : "")}
              </span>
            </div>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => goTo(step + 1)} className={buttonClass("primary")}>
                Continue
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : (
              status !== "published" && (
                <button type="button" disabled={isPending || missing.length > 0} onClick={publish} className={buttonClass("primary")}>
                  {isPending ? "Publishing..." : "Publish"}
                </button>
              )
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {step === 0 && !event && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <h2 className="font-semibold text-slate-900">Event template</h2>
              {templates.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No templates yet. You can save any event as a template on the Review step.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-500">Start from a saved plan.</p>
                  <select aria-label="Event template" defaultValue="" onChange={(e) => applyTemplate(e.target.value)} className={INPUT}>
                    <option value="" disabled>Choose a template</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </>
              )}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="font-semibold text-slate-900">Summary</h2>
            <SummaryList values={values} members={members} compact />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryList({
  values,
  members,
  compact = false,
}: {
  values: EventInput;
  members: { id: string; name: string }[];
  compact?: boolean;
}) {
  let when = "Not set";
  if (values.startsAt) {
    try {
      when = formatEventWhen(fromDateTimeInput(values.startsAt), values.endsAt ? fromDateTimeInput(values.endsAt) : null);
    } catch {
      when = "Check the date";
    }
  }
  const rows: [string, string][] = [
    ["Name", values.title || "Not set"],
    ["Program", values.program || "Not set"],
    ["Owner", members.find((m) => m.id === values.ownerId)?.name ?? "Unassigned"],
    ["When", when],
    ["Format", FORMAT_LABELS[values.format]],
    ...(values.format !== "online" ? ([["Venue", values.venueName || "Not set"]] as [string, string][]) : []),
    ["Tickets", values.ticketType === "paid" ? `Paid${values.ticketPrice ? `, $${values.ticketPrice}` : ""}` : "Free"],
    ["Capacity", values.capacity || "Unlimited"],
    ["Budget", values.budgetAmount ? `$${Number(values.budgetAmount).toLocaleString()}` : "Not set"],
  ];
  return (
    <dl className={`mt-2 grid gap-x-4 gap-y-2 text-sm ${compact ? "" : "sm:grid-cols-2"}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="break-words text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
      {label}
    </label>
  );
}

function Repeater({
  title,
  addLabel,
  rows,
  placeholders,
  onChange,
}: {
  title: string;
  addLabel: string;
  rows: string[][];
  placeholders: [string, string];
  onChange: (rows: string[][]) => void;
}) {
  return (
    <div>
      <p className={LABEL}>{title}</p>
      <div className="mt-1 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {placeholders.map((placeholder, column) => (
              <input
                key={placeholder}
                aria-label={`${title} ${i + 1}: ${placeholder}`}
                placeholder={placeholder}
                value={row[column]}
                onChange={(e) => onChange(rows.map((r, ri) => (ri === i ? r.map((v, ci) => (ci === column ? e.target.value : v)) : r)))}
                className={`${INPUT} mt-0 ${column === 0 ? "sm:w-44 sm:shrink-0" : ""}`}
              />
            ))}
            <button
              type="button"
              aria-label={`Remove ${title} ${i + 1}`}
              onClick={() => onChange(rows.filter((_, ri) => ri !== i))}
              className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...rows, ["", ""]])} className={`${buttonClass("ghost", "sm")} mt-2`}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        {addLabel}
      </button>
    </div>
  );
}
