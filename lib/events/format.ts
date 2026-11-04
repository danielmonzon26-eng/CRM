import type { EventFormat, EventStatus, EventTicketType } from "@/lib/supabase/types";

// Events are run from Calgary, so times are entered and shown in Calgary time for
// everyone, whatever timezone the viewer or the server is in.
export const EVENT_TIME_ZONE = "America/Edmonton";

export const FORMAT_LABELS: Record<EventFormat, string> = {
  in_person: "In person",
  online: "Online / livestream",
  hybrid: "In person + livestream",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<EventStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

const dateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function calgaryParts(date: Date): Record<string, string> {
  return Object.fromEntries(partsFormat.formatToParts(date).map((p) => [p.type, p.value]));
}

/** The Calgary calendar day of an instant, as YYYY-MM-DD. */
export function calgaryDateKey(iso: string | Date): string {
  const p = calgaryParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}`;
}

/** An instant as the value of a datetime-local input, in Calgary time. */
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const p = calgaryParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** A datetime-local input value, read as Calgary time, as an ISO instant. */
export function fromDateTimeInput(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error("Invalid date and time");
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  // The offset depends on the instant (daylight saving), so resolve it from a first guess.
  const offsetAt = (instant: number) => {
    const p = calgaryParts(new Date(instant));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant;
  };
  const guess = wallClock - offsetAt(wallClock);
  return new Date(wallClock - offsetAt(guess)).toISOString();
}

export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = dateTimeFormat.format(new Date(startsAt));
  if (!endsAt) return `${start} MT`;
  const sameDay = calgaryDateKey(startsAt) === calgaryDateKey(endsAt);
  const end = sameDay ? timeFormat.format(new Date(endsAt)) : dateTimeFormat.format(new Date(endsAt));
  return `${start} – ${end} MT`;
}

export function formatEventTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatTicketPrice(
  ticketType: EventTicketType,
  price: number | null,
  currency: string
): string {
  if (ticketType === "free") return "Free";
  if (price == null) return "Paid";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(price);
}

export function isEventOver(startsAt: string, endsAt: string | null): boolean {
  return new Date(endsAt ?? startsAt).getTime() < Date.now();
}

/** A YouTube or Vimeo link as an embeddable player URL, or null for anything else. */
export function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
