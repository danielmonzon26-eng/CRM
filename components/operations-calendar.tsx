"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import luxon3Plugin from "@fullcalendar/luxon3";
import timeGridPlugin from "@fullcalendar/timegrid";
import { AlertTriangle, CheckSquare2, ChevronLeft, ChevronRight, ExternalLink, MapPin, MonitorPlay, Plus, Users, X } from "lucide-react";
import { rescheduleEvent, rescheduleTask } from "@/app/actions/calendar";
import { buttonClass } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/use-dismiss";
import { describeConflict, findConflicts } from "@/lib/calendar/conflicts";
import type { CalendarEvent, CalendarTask } from "@/lib/calendar/queries";
import { EVENT_TIME_ZONE, EVENT_TIME_ZONE_LABEL, FORMAT_LABELS, STATUS_LABELS, STATUS_STYLES, fromDateTimeInput, toDateTimeInput } from "@/lib/events/format";

const VIEWS = [
  ["dayGridMonth", "Month"],
  ["timeGridWeek", "Week"],
  ["timeGridDay", "Day"],
  ["listMonth", "Agenda"],
] as const;
type ViewName = (typeof VIEWS)[number][0];

/** Fixed order, validated for colour-blind separation. Identity is also in the title and legend. */
const PROGRAM_COLORS: [string, string][] = [
  ["Apex Forum", "#D2460F"],
  ["Apex Summit", "#2563EB"],
  ["Catapult Event", "#0D9488"],
  ["Elevate IP", "#A21CAF"],
];
const OTHER_COLOR = "#64748B";
const programColor = (program: string | null) => PROGRAM_COLORS.find(([name]) => name === program)?.[1] ?? OTHER_COLOR;

const TIME_ZONES = [
  [EVENT_TIME_ZONE, "Calgary"],
  ["America/Vancouver", "Vancouver"],
  ["America/Toronto", "Toronto"],
  ["UTC", "UTC"],
  ["local", "My device"],
] as const;

const SELECT = "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const VIEW_KEY = "catapult-calendar-view";

type Panel =
  | { kind: "event"; event: CalendarEvent }
  | { kind: "task"; task: CalendarTask }
  | { kind: "day"; label: string; start: string };

function formatInZone(iso: string, timeZone: string): string {
  const calgary = timeZone === EVENT_TIME_ZONE;
  const text = new Date(iso).toLocaleString("en-CA", {
    timeZone: timeZone === "local" ? undefined : timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: calgary ? undefined : "short",
  });
  return calgary ? `${text} ${EVENT_TIME_ZONE_LABEL}` : text;
}

function renderEventContent(arg: EventContentArg) {
  const { kind, color, status, completed, hasConflict } = arg.event.extendedProps as {
    kind: "event" | "task";
    color: string;
    status?: string;
    completed?: boolean;
    hasConflict?: boolean;
  };
  const struck = status === "cancelled" || completed;

  return (
    <span
      className={`flex w-full min-w-0 items-center gap-1 rounded-[3px] border-l-[3px] bg-white px-1.5 py-0.5 text-[11px] font-medium leading-tight text-slate-800 ${
        status === "draft" ? "border-y border-r border-dashed border-y-slate-300 border-r-slate-300" : "shadow-sm"
      } ${struck ? "opacity-60" : ""}`}
      style={{ borderLeftColor: color }}
    >
      {kind === "task" && <CheckSquare2 className="h-3 w-3 shrink-0 text-slate-500" strokeWidth={2} aria-label="Task" />}
      {hasConflict && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" strokeWidth={2.25} aria-label="Scheduling conflict" />}
      {arg.timeText && kind === "event" && <span className="shrink-0 text-slate-500">{arg.timeText}</span>}
      <span className={`truncate ${struck ? "line-through" : ""}`}>{arg.event.title}</span>
    </span>
  );
}

export function OperationsCalendar({
  events,
  tasks,
  members,
}: {
  events: CalendarEvent[];
  tasks: CalendarTask[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<ViewName>("dayGridMonth");
  const [timeZone, setTimeZone] = useState<string>(EVENT_TIME_ZONE);
  const [program, setProgram] = useState("");
  const [memberId, setMemberId] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const panelRef = useDismiss<HTMLElement>(panel !== null, closePanel);

  useEffect(() => {
    let initial: string | null = null;
    try {
      initial = localStorage.getItem(VIEW_KEY);
    } catch {
      // Remembering the view is only a convenience.
    }
    const saved = VIEWS.find(([name]) => name === initial)?.[0];
    const next = saved ?? (window.innerWidth < 768 ? "listMonth" : "dayGridMonth");
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  }, []);

  function changeView(next: ViewName) {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembering the view is only a convenience.
    }
  }

  const programs = useMemo(() => [...new Set(events.map((e) => e.program ?? "Other"))].sort(), [events]);
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Unassigned";

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const conflictedIds = useMemo(
    () => new Set(events.filter((e) => findConflicts(e, e.startsAt, e.endsAt, events).length > 0).map((e) => e.id)),
    [events]
  );
  const upcomingConflicts = useMemo(
    () => events.filter((e) => conflictedIds.has(e.id) && new Date(e.startsAt).getTime() >= Date.now()).length,
    [events, conflictedIds]
  );

  const calendarItems = useMemo<EventInput[]>(() => {
    const items: EventInput[] = [];
    if (showEvents) {
      for (const e of events) {
        if (program && (e.program ?? "Other") !== program) continue;
        if (memberId && e.ownerId !== memberId) continue;
        items.push({
          id: `event-${e.id}`,
          title: e.title,
          start: e.startsAt,
          end: e.endsAt ?? undefined,
          editable: e.status !== "cancelled",
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: { kind: "event", sourceId: e.id, color: programColor(e.program), status: e.status, hasConflict: conflictedIds.has(e.id) },
        });
      }
    }
    if (showTasks && !program) {
      for (const t of tasks) {
        if (memberId && t.assignedTo !== memberId) continue;
        // A deadline is a day, not a time slot. Which day is always decided in Calgary time.
        items.push({
          id: `task-${t.id}`,
          title: t.title,
          start: toDateTimeInput(t.dueAt).slice(0, 10),
          allDay: true,
          editable: !t.completed,
          durationEditable: false,
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: { kind: "task", sourceId: t.id, color: OTHER_COLOR, completed: t.completed },
        });
      }
    }
    return items;
  }, [events, tasks, program, memberId, showEvents, showTasks, conflictedIds]);

  async function applyMove(arg: EventDropArg | EventResizeDoneArg) {
    const { kind, sourceId } = arg.event.extendedProps as { kind: "event" | "task"; sourceId: string };
    setNotice(null);

    if (kind === "task") {
      const day = arg.event.startStr.slice(0, 10);
      const result = await rescheduleTask(sourceId, fromDateTimeInput(`${day}T23:59`));
      if (result.error) {
        arg.revert();
        setNotice({ tone: "error", text: `That task didn't move: ${result.error}` });
      } else {
        router.refresh();
      }
      return;
    }

    const event = eventById.get(sourceId);
    if (!event || !arg.event.start) {
      arg.revert();
      return;
    }
    const startsAt = arg.event.start.toISOString();
    const endsAt = arg.event.end ? arg.event.end.toISOString() : null;

    const warnings: string[] = findConflicts(event, startsAt, endsAt, events).map(describeConflict);
    if (event.registered > 0) {
      warnings.push(`${event.registered} ${event.registered === 1 ? "person has" : "people have"} registered, and nobody is notified automatically.`);
    }
    if (warnings.length > 0 && !confirm(`Move "${event.title}"?\n\n${warnings.join("\n")}`)) {
      arg.revert();
      return;
    }

    const result = await rescheduleEvent(sourceId, startsAt, endsAt);
    if (result.error) {
      arg.revert();
      setNotice({ tone: "error", text: `That event didn't move: ${result.error}` });
      return;
    }
    setNotice({ tone: "ok", text: `Moved "${event.title}" to ${formatInZone(startsAt, timeZone)}.` });
    router.refresh();
  }

  function handleEventClick(arg: EventClickArg) {
    const { kind, sourceId } = arg.event.extendedProps as { kind: "event" | "task"; sourceId: string };
    if (kind === "event") {
      const event = eventById.get(sourceId);
      if (event) setPanel({ kind: "event", event });
    } else {
      const task = taskById.get(sourceId);
      if (task) setPanel({ kind: "task", task });
    }
  }

  function handleDateClick(arg: DateClickArg) {
    // A day cell has no time, so it defaults to 9 a.m. A time slot is converted to Calgary
    // time, which is what the Create Event form works in.
    const start = arg.allDay ? `${arg.dateStr.slice(0, 10)}T09:00` : toDateTimeInput(arg.date.toISOString());
    const label = arg.allDay
      ? new Date(`${arg.dateStr.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
      : formatInZone(arg.date.toISOString(), timeZone);
    setPanel({ kind: "day", label, start });
  }

  const api = () => calendarRef.current?.getApi();
  const panelConflicts = panel?.kind === "event" ? findConflicts(panel.event, panel.event.startsAt, panel.event.endsAt, events) : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => api()?.prev()} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" aria-label="Next" onClick={() => api()?.next()} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => api()?.today()} className={buttonClass("secondary")}>Today</button>
        </div>
        <h2 aria-live="polite" className="min-w-40 px-1 text-lg font-semibold text-slate-900">{title}</h2>
        <div role="group" aria-label="Calendar view" className="ml-auto flex rounded-lg border border-slate-200 bg-white p-0.5">
          {VIEWS.map(([name, label]) => (
            <button
              key={name}
              type="button"
              aria-pressed={view === name}
              onClick={() => changeView(name)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === name ? "bg-brand-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Program" value={program} onChange={(e) => setProgram(e.target.value)} className={SELECT}>
          <option value="">Program: All</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Team member" value={memberId} onChange={(e) => setMemberId(e.target.value)} className={SELECT}>
          <option value="">Team: Everyone</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Time zone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={SELECT}>
          {TIME_ZONES.map(([zone, label]) => <option key={zone} value={zone}>Time zone: {label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 px-1 text-sm text-slate-700">
          <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Events
        </label>
        <label className="flex items-center gap-1.5 px-1 text-sm text-slate-700">
          <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Task deadlines
        </label>
        <Link href="/events/new" className={`${buttonClass("primary")} ml-auto`}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New event
        </Link>
      </div>

      {upcomingConflicts > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
          {upcomingConflicts} upcoming {upcomingConflicts === 1 ? "event overlaps" : "events overlap"} another event with the same venue or owner. Look for the warning icon.
        </p>
      )}
      {notice && (
        <p role="status" className={`mb-3 rounded-lg p-3 text-sm ${notice.tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
          {notice.text}
        </p>
      )}

      <div className="catapult-calendar rounded-xl border border-slate-200 bg-white p-3 shadow-card">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
          initialView="dayGridMonth"
          timeZone={timeZone}
          headerToolbar={false}
          height="auto"
          events={calendarItems}
          editable
          eventDisplay="block"
          eventInteractive
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventDrop={(arg) => void applyMove(arg)}
          eventResize={(arg) => void applyMove(arg)}
          datesSet={(arg: DatesSetArg) => setTitle(arg.view.title)}
          dayMaxEvents={3}
          nowIndicator
          scrollTime="08:00:00"
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          allDayText="Due"
          noEventsText="Nothing scheduled in this period."
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {[...PROGRAM_COLORS, ["Other programs", OTHER_COLOR] as [string, string]].map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-sm" style={{ backgroundColor: color }} />
            {name}
          </span>
        ))}
        <span className="flex items-center gap-1"><CheckSquare2 className="h-3 w-3 text-slate-500" strokeWidth={2} />Task</span>
        <span className="rounded border border-dashed border-slate-400 px-1.5">Draft</span>
        <span className="line-through">Cancelled</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" strokeWidth={2.25} />Conflict</span>
        <span className="text-slate-500">Drag to reschedule. Click a day to create.</span>
      </div>

      {panel && (
        <aside
          ref={panelRef}
          role="dialog"
          aria-label="Details"
          className="fixed inset-y-0 right-0 z-30 flex w-96 max-w-full flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-popover"
        >
          <button type="button" aria-label="Close" onClick={closePanel} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>

          {panel.kind === "event" && (
            <>
              <p className="flex items-center gap-1.5 pr-8 text-xs font-medium text-slate-600">
                <span className="h-3 w-[3px] rounded-sm" style={{ backgroundColor: programColor(panel.event.program) }} />
                {panel.event.program ?? "No program"}
              </p>
              <h3 className="mt-1 pr-8 text-lg font-semibold text-slate-900">{panel.event.title}</h3>
              <span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[panel.event.status]}`}>{STATUS_LABELS[panel.event.status]}</span>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">When</dt>
                  <dd className="text-slate-900">
                    {formatInZone(panel.event.startsAt, timeZone)}
                    {panel.event.endsAt && <span className="block">to {formatInZone(panel.event.endsAt, timeZone)}</span>}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  {panel.event.format === "online" ? <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />}
                  <span className="text-slate-900">{panel.event.format === "online" ? FORMAT_LABELS.online : panel.event.venueName ?? "Venue not set"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                  <span className="text-slate-900">{panel.event.registered}{panel.event.capacity ? ` of ${panel.event.capacity}` : ""} registered</span>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Owner</dt>
                  <dd className="text-slate-900">{memberName(panel.event.ownerId)}</dd>
                </div>
              </dl>
              {panelConflicts.length > 0 && (
                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" strokeWidth={2} />Scheduling conflict</p>
                  <ul className="mt-1 space-y-0.5">{panelConflicts.map((c) => <li key={c.eventId}>{describeConflict(c)}</li>)}</ul>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/events/${panel.event.id}`} className={buttonClass("primary")}>Open workspace</Link>
                <Link href={`/events/${panel.event.id}/edit?step=1`} className={buttonClass("secondary")}>Edit schedule</Link>
                <a href={`/register/${panel.event.slug}`} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
                  <ExternalLink className="h-4 w-4" strokeWidth={2} />
                  Landing page
                </a>
              </div>
            </>
          )}

          {panel.kind === "task" && (
            <>
              <p className="flex items-center gap-1.5 pr-8 text-xs font-medium text-slate-600"><CheckSquare2 className="h-3.5 w-3.5" strokeWidth={2} />Task</p>
              <h3 className={`mt-1 pr-8 text-lg font-semibold text-slate-900 ${panel.task.completed ? "line-through" : ""}`}>{panel.task.title}</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Due</dt>
                  <dd className="text-slate-900">{new Date(panel.task.dueAt).toLocaleDateString("en-CA", { timeZone: EVENT_TIME_ZONE, weekday: "short", month: "short", day: "numeric", year: "numeric" })}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Assigned to</dt>
                  <dd className="text-slate-900">{memberName(panel.task.assignedTo)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="text-slate-900">{panel.task.completed ? "Completed" : "Open"}</dd>
                </div>
              </dl>
              <div className="mt-5"><Link href={panel.task.href} className={buttonClass("primary")}>Open</Link></div>
            </>
          )}

          {panel.kind === "day" && (
            <>
              <p className="pr-8 text-xs font-medium text-slate-600">Create</p>
              <h3 className="mt-1 pr-8 text-lg font-semibold text-slate-900">{panel.label}</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/events/new?start=${encodeURIComponent(panel.start)}`} className={buttonClass("primary")}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  New event
                </Link>
                <Link href="/tasks" className={buttonClass("secondary")}>Go to tasks</Link>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
