import type { CalendarEvent } from "@/lib/calendar/queries";

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export type EventConflict = { eventId: string; title: string; reason: "venue" | "owner" };

function endOf(startsAt: string, endsAt: string | null): number {
  return endsAt ? new Date(endsAt).getTime() : new Date(startsAt).getTime() + DEFAULT_DURATION_MS;
}

/** Other active events overlapping this time that share its in-person venue or its owner. */
export function findConflicts(
  event: Pick<CalendarEvent, "id" | "format" | "venueName" | "ownerId" | "status">,
  startsAt: string,
  endsAt: string | null,
  events: CalendarEvent[]
): EventConflict[] {
  if (event.status === "cancelled") return [];
  const start = new Date(startsAt).getTime();
  const end = endOf(startsAt, endsAt);
  const venue = event.format !== "online" ? event.venueName?.trim().toLowerCase() : null;

  return events.flatMap((other): EventConflict[] => {
    if (other.id === event.id || other.status === "cancelled") return [];
    if (new Date(other.startsAt).getTime() >= end || endOf(other.startsAt, other.endsAt) <= start) return [];

    if (venue && other.format !== "online" && other.venueName?.trim().toLowerCase() === venue) {
      return [{ eventId: other.id, title: other.title, reason: "venue" }];
    }
    if (event.ownerId && other.ownerId === event.ownerId) {
      return [{ eventId: other.id, title: other.title, reason: "owner" }];
    }
    return [];
  });
}

export function describeConflict(conflict: EventConflict): string {
  return `${conflict.reason === "venue" ? "Same venue as" : "Same owner as"} "${conflict.title}"`;
}
