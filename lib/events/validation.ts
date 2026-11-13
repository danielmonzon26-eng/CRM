import type { AgendaItem, EventFormat, EventTicketType, Speaker } from "@/lib/supabase/types";

export type EventInput = {
  title: string;
  program: string;
  eventType: string;
  description: string;
  imageUrl: string;
  ownerId: string;
  startsAt: string;
  endsAt: string;
  format: EventFormat;
  venueName: string;
  venueAddress: string;
  onlineUrl: string;
  agenda: AgendaItem[];
  speakers: Speaker[];
  ticketType: EventTicketType;
  ticketPrice: string;
  capacity: string;
  targetAttendees: string;
  collectCompany: boolean;
  collectPhone: boolean;
  waitlistEnabled: boolean;
  registrationOpensAt: string;
  registrationClosesAt: string;
  confirmationMessage: string;
  budgetAmount: string;
  fundingSource: string;
  budgetNotes: string;
};

export function isWebUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * A link as a full web address: "zoom.us/j/123" becomes "https://zoom.us/j/123". Blank
 * stays blank; null means it isn't a web address at all (e.g. "TBD").
 */
export function normalizeWebUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  if (isWebUrl(v)) return v;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/]+\.[^\s]+$/.test(v) && isWebUrl(`https://${v}`)) return `https://${v}`;
  return null;
}

/** Everything still needed before an event can be published. */
export function getMissingForPublish(input: EventInput): string[] {
  const missing: string[] = [];
  if (!input.title.trim()) missing.push("Event name");
  if (!input.startsAt) missing.push("Start date and time");
  if (input.format !== "online" && !input.venueName.trim()) missing.push("Venue");
  if (input.ticketType === "paid" && !input.ticketPrice.trim()) missing.push("Ticket price");
  return missing;
}

/** Worth adding, but not needed to publish: the join link can come later. */
export function getPublishReminders(input: EventInput): string[] {
  const reminders: string[] = [];
  if (input.format !== "in_person" && !input.onlineUrl.trim()) reminders.push("Livestream or join link");
  return reminders;
}
