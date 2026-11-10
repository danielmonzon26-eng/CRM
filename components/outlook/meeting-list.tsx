import Link from "next/link";
import { CalendarDays, MapPin, Video } from "lucide-react";
import type { MeetingItem } from "@/lib/outlook/queries";

const ZONE = "America/Edmonton";
const day = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: ZONE });
const time = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
const allDay = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function when(meeting: MeetingItem): string {
  if (meeting.isAllDay) return `${allDay.format(new Date(meeting.startsAt))} · All day`;
  const start = new Date(meeting.startsAt);
  return `${day.format(start)} · ${time.format(start)}–${time.format(new Date(meeting.endsAt))}`;
}

export function MeetingList({ meetings, emptyText = "No meetings." }: { meetings: MeetingItem[]; emptyText?: string }) {
  if (meetings.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  const now = Date.now();

  return (
    <ul className="space-y-2">
      {meetings.map((m) => {
        const past = new Date(m.endsAt).getTime() < now;
        return (
          <li key={m.id} className={`rounded-lg border border-slate-200 bg-white p-3 shadow-card ${past ? "opacity-75" : ""}`}>
            <p className="flex items-start gap-2 text-sm font-medium text-slate-900">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              <span className="min-w-0 break-words">{m.subject}</span>
            </p>
            <p className="mt-1 pl-6 text-xs text-slate-600">
              {when(m)}
              {past && " · Past"}
            </p>
            {m.location && (
              <p className="mt-0.5 flex items-center gap-1 pl-6 text-xs text-slate-600">
                <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                <span className="truncate">{m.location}</span>
              </p>
            )}
            {m.contacts.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1 pl-6">
                {m.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/leads/${c.leadId}`}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                ))}
              </p>
            )}
            {m.onlineUrl && !past && (
              <a
                href={m.onlineUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 ml-6 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <Video className="h-3.5 w-3.5" strokeWidth={2} />
                Join online
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
