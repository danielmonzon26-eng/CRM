import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { FORMAT_LABELS, formatEventWhen } from "@/lib/events/format";
import type { LeadEventRegistration } from "@/lib/events/queries";

export function EventRegistrationsSection({ registrations }: { registrations: LeadEventRegistration[] }) {
  return (
    <>
      <h2 className="text-sm font-semibold text-slate-700">Events ({registrations.length})</h2>
      <div className="mt-2 space-y-2">
        {registrations.length === 0 && <p className="text-sm text-slate-400">Not registered for any events yet.</p>}
        {registrations.map((r) => (
          <Link
            key={r.id}
            href={`/events/${r.eventId}`}
            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card hover:border-brand-200"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <CalendarDays className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{r.eventTitle}</p>
              <p className="text-xs text-slate-500">{formatEventWhen(r.startsAt, r.endsAt)}</p>
              <p className="mt-1 text-xs text-slate-600">
                {r.attendeeName} · {FORMAT_LABELS[r.attendanceMode]} ·{" "}
                {r.status === "cancelled" ? "Cancelled" : r.checkedInAt ? "Attended" : "Registered"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
