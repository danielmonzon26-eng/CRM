import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, MonitorPlay, Users } from "lucide-react";
import { getEventDetail } from "@/lib/events/queries";
import { STATUS_LABELS, STATUS_STYLES, formatEventWhen } from "@/lib/events/format";
import { getEventRevenueEntries } from "@/lib/events/queries";
import { getLineDetailForEvent } from "@/lib/budgets/queries";
import { getEventReport } from "@/lib/reports/queries";
import { getSiteUrl } from "@/lib/site-url";
import { getTasksForSubject } from "@/lib/tasks/queries";
import { getEventFeedback } from "@/lib/events/feedback-queries";
import { isEventOver } from "@/lib/events/format";
import { EventFeedbackTab } from "@/components/event-feedback-tab";
import { EventActionsMenu } from "./event-controls";
import {
  AgendaTab,
  AnalyticsTab,
  BudgetTab,
  CommunicationsTab,
  FilesTab,
  OverviewTab,
  RegistrationsTab,
  SpeakersTab,
  TasksTab,
  getCounts,
} from "./workspace-tabs";

export const dynamic = "force-dynamic";
// Feedback emails go out in batches spaced to Outlook's sending limit.
export const maxDuration = 60;

const TABS = [
  ["overview", "Overview"],
  ["registrations", "Registrations"],
  ["agenda", "Agenda"],
  ["speakers", "Speakers"],
  ["budget", "Budget"],
  ["tasks", "Tasks"],
  ["communications", "Communications"],
  ["files", "Files"],
  ["feedback", "Feedback"],
  ["analytics", "Analytics"],
] as const;

export default async function EventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { tab, notice } = await searchParams;
  const [detail, tasks, line, revenue, report, feedback] = await Promise.all([
    getEventDetail(id),
    getTasksForSubject({ eventId: id }),
    getLineDetailForEvent(id),
    getEventRevenueEntries(id),
    getEventReport(id),
    getEventFeedback(id),
  ]);
  if (!detail) notFound();

  const { event } = detail;
  const active = TABS.some(([value]) => value === tab) ? tab : "overview";
  const counts = getCounts(detail, tasks);
  const landingUrl = `${await getSiteUrl()}/register/${event.slug}`;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {notice === "materials" && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            The event was saved, but some materials or the video link didn&apos;t save. Please add them again under Files.
          </p>
        )}

        {/* With a photo, the header is a 400px banner: the photo shows in full, darkening toward
            the bottom so the title stays readable. No overflow-hidden, so the Actions menu can
            drop below it. */}
        <header className={`relative flex rounded-xl bg-ink-950 text-white ${event.image_url ? "min-h-[400px] items-end" : ""}`}>
          {event.image_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.image_url} alt="" className="absolute inset-0 h-full w-full rounded-xl object-cover" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/10" aria-hidden="true" />
            </>
          )}
          <div className={`relative flex w-full flex-wrap justify-between gap-4 p-6 ${event.image_url ? "items-end sm:p-8" : "items-start"}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-200">{[event.program, event.event_type].filter(Boolean).join(" · ") || "Event"}</p>
              <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">{event.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-100">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" strokeWidth={2} />
                  {formatEventWhen(event.starts_at, event.ends_at)}
                </span>
                {event.format !== "online" && event.venue_name && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={2} />
                    {event.venue_name}
                  </span>
                )}
                {event.format !== "in_person" && (
                  <span className="flex items-center gap-1.5">
                    <MonitorPlay className="h-4 w-4" strokeWidth={2} />
                    Livestream
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" strokeWidth={2} />
                  {counts.registered.length}
                  {event.target_attendees ? ` of ${event.target_attendees} target` : event.capacity ? ` / ${event.capacity}` : " registered"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status]}`}>{STATUS_LABELS[event.status]}</span>
                {event.archived_at && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">Archived</span>}
              </div>
            </div>
            <EventActionsMenu eventId={event.id} slug={event.slug} status={event.status} archived={Boolean(event.archived_at)} />
          </div>
        </header>

        <nav aria-label="Event sections" className="mb-5 mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map(([value, label]) => (
            <Link
              key={value}
              href={`/events/${event.id}${value === "overview" ? "" : `?tab=${value}`}`}
              aria-current={value === active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                value === active ? "border-brand-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
              {value === "registrations" && <span className="ml-1.5 text-xs font-normal text-slate-500">{counts.registered.length}</span>}
              {value === "tasks" && counts.tasksOpen > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">{counts.tasksOpen}</span>}
              {value === "feedback" && feedback.responses.length > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">{feedback.responses.length}</span>}
            </Link>
          ))}
        </nav>

        {active === "overview" && <OverviewTab detail={detail} tasks={tasks} landingUrl={landingUrl} line={line?.line ?? null} />}
        {active === "registrations" && <RegistrationsTab detail={detail} />}
        {active === "feedback" && (
          <EventFeedbackTab
            eventId={event.id}
            eventTitle={event.title}
            eventOver={isEventOver(event.starts_at, event.ends_at)}
            summary={feedback}
            registeredCount={counts.registered.length}
            attendedCount={counts.checkedIn}
          />
        )}
        {active === "agenda" && <AgendaTab detail={detail} />}
        {active === "speakers" && <SpeakersTab detail={detail} />}
        {active === "budget" && <BudgetTab detail={detail} line={line} revenue={revenue} report={report[0] ?? null} />}
        {active === "tasks" && <TasksTab eventId={event.id} tasks={tasks} />}
        {active === "communications" && <CommunicationsTab detail={detail} />}
        {active === "files" && <FilesTab detail={detail} />}
        {active === "analytics" && <AnalyticsTab detail={detail} report={report[0] ?? null} />}
      </div>
    </main>
  );
}
