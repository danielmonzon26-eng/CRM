import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getEventsBetween, type EventRow } from "@/lib/events/queries";
import { FORMAT_LABELS, calgaryDateKey, formatEventTime } from "@/lib/events/format";
import type { EventFormat } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FORMAT_STYLES: Record<EventFormat, string> = {
  in_person: "bg-brand-50 text-brand-700 hover:bg-brand-100",
  online: "bg-sky-50 text-sky-700 hover:bg-sky-100",
  hybrid: "bg-violet-50 text-violet-700 hover:bg-violet-100",
};

/** Calendar arithmetic only. These Dates hold a day in UTC fields and are never shown as instants. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseMonth(value: string | undefined): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 };
  const [year, month] = calgaryDateKey(new Date()).split("-").map(Number);
  return { year, month: month - 1 };
}

function monthParam(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 1));
  return dayKey(date).slice(0, 7);
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthValue } = await searchParams;
  const { year, month } = parseMonth(monthValue);

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const gridStart = new Date(Date.UTC(year, month, 1 - firstOfMonth.getUTCDay()));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((firstOfMonth.getUTCDay() + daysInMonth) / 7);
  const days = Array.from(
    { length: weeks * 7 },
    (_, i) => new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + i))
  );

  // A day of padding each side covers the gap between UTC and Calgary midnight.
  const rangeStart = new Date(days[0].getTime() - 86400000).toISOString();
  const rangeEnd = new Date(days[days.length - 1].getTime() + 2 * 86400000).toISOString();
  const events = await getEventsBetween(rangeStart, rangeEnd);

  const eventsByDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const startKey = calgaryDateKey(event.starts_at);
    const endKey = event.ends_at ? calgaryDateKey(event.ends_at) : startKey;
    const cursor = new Date(`${startKey}T00:00:00Z`);
    for (let i = 0; i < 366 && dayKey(cursor) <= endKey; i++) {
      const key = dayKey(cursor);
      eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const today = calgaryDateKey(new Date());
  const title = firstOfMonth.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900">Calendar</h1>
            <p className="text-sm text-slate-500">All events, in Calgary time</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?month=${monthParam(year, month - 1)}`}
              aria-label="Previous month"
              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <p className="w-40 text-center text-sm font-semibold text-slate-900">{title}</p>
            <Link
              href={`/calendar?month=${monthParam(year, month + 1)}`}
              aria-label="Next month"
              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link href="/calendar" className="ml-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Today
            </Link>
          </div>
        </header>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-medium text-slate-400">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = dayKey(day);
                const inMonth = day.getUTCMonth() === month;
                return (
                  <div key={key} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${inMonth ? "" : "bg-slate-50/70"}`}>
                    <p
                      className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        key === today ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {day.getUTCDate()}
                    </p>
                    <div className="space-y-1">
                      {(eventsByDay.get(key) ?? []).map((event) => (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          title={event.title}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${FORMAT_STYLES[event.format]} ${
                            event.status === "cancelled" ? "line-through opacity-60" : ""
                          } ${event.status === "draft" ? "border border-dashed border-current" : ""}`}
                        >
                          {calgaryDateKey(event.starts_at) === key && `${formatEventTime(event.starts_at)} `}
                          {event.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {(Object.keys(FORMAT_LABELS) as EventFormat[]).map((format) => (
            <span key={format} className={`rounded px-1.5 py-0.5 ${FORMAT_STYLES[format]}`}>{FORMAT_LABELS[format]}</span>
          ))}
          <span className="rounded border border-dashed border-slate-400 px-1.5 py-0.5">Draft</span>
          <span className="px-1.5 py-0.5 line-through">Cancelled</span>
        </div>
      </div>
    </main>
  );
}
