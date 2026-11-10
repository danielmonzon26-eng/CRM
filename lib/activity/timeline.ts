import { createClient } from "@/lib/supabase/server";
import { getDiscoveryCalls } from "@/lib/discovery/queries";
import { getEventRegistrationsForLead } from "@/lib/events/queries";
import { getEmailsForAddresses, getMeetingsForAddresses } from "@/lib/outlook/queries";
import type { NoteKind } from "@/lib/supabase/types";

/** Filter groups in the Activity Centre. */
export type TimelineCategory = "notes" | "calls" | "email" | "proposals" | "stage" | "events" | "discovery" | "tasks" | "system";

export type TimelineItem = {
  id: string;
  at: string;
  /** Formatted on the server, so the page matches when it loads in the browser. */
  timeLabel: string;
  dayLabel: string;
  category: TimelineCategory;
  /** Picks the icon. */
  type: string;
  title: string;
  body?: string | null;
  actor?: string | null;
  href?: string;
};

export type LeadNote = {
  id: string;
  kind: NoteKind;
  body: string;
  occurredAt: string;
  occurredLabel: string;
  pinned: boolean;
  author: string | null;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
};

const ACTIVITY_CATEGORY: Record<string, TimelineCategory> = {
  status_change: "stage",
  note: "stage",
  email_sent: "email",
  call_logged: "calls",
  task_completed: "tasks",
  deal_created: "proposals",
  deal_stage_change: "proposals",
  event_registration: "events",
  enrichment_run: "system",
  sync_matched: "system",
};

const ACTIVITY_TITLE: Record<string, string> = {
  status_change: "Stage or status changed",
  note: "Update",
  email_sent: "Email sent from the CRM",
  call_logged: "Call",
  task_completed: "Task completed",
  deal_created: "Proposal created",
  deal_stage_change: "Proposal moved",
  event_registration: "Registered for an event",
  enrichment_run: "Contacts looked up",
  sync_matched: "Data sync",
};

const ZONE = "America/Edmonton";
const timeFormat = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: ZONE });
const fullFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });

function dayLabel(at: string): string {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONE });
  const date = new Date(at);
  if (key(date) === key(new Date())) return "Today";
  if (key(date) === key(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return dayFormat.format(date);
}

export const NOTE_KIND_LABELS: Record<NoteKind, string> = { note: "Note", call: "Call", meeting: "Meeting", email: "Email" };

/**
 * Every touchpoint with a lead's company, newest first: notes, stage and status changes,
 * Outlook email and meetings, proposals, events, discovery calls and tasks.
 */
export async function getActivityTimeline(leadId: string, contactEmails: string[]): Promise<{ notes: LeadNote[]; items: TimelineItem[] }> {
  const supabase = await createClient();
  const [notesResult, activitiesResult, profilesResult, emails, meetings, calls, registrations] = await Promise.all([
    supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("occurred_at", { ascending: false }),
    supabase.from("activities").select("id, type, body, actor_id, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id, full_name, email"),
    getEmailsForAddresses(contactEmails, "", 200).catch(() => []),
    getMeetingsForAddresses(contactEmails, 100).catch(() => []),
    getDiscoveryCalls(leadId).catch(() => []),
    getEventRegistrationsForLead(leadId).catch(() => []),
  ]);
  if (notesResult.error) throw notesResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const nameOf = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Someone"]));
  const who = (id: string | null) => (id ? nameOf.get(id) ?? "Someone" : null);

  const notes: LeadNote[] = (notesResult.data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    occurredAt: n.occurred_at,
    occurredLabel: fullFormat.format(new Date(n.occurred_at)),
    pinned: n.pinned,
    author: who(n.created_by),
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    edited: new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 60_000,
  }));

  const items: Omit<TimelineItem, "timeLabel" | "dayLabel">[] = [];

  for (const n of notes) {
    items.push({
      id: `note-${n.id}`,
      at: n.occurredAt,
      category: n.kind === "call" || n.kind === "meeting" ? "calls" : n.kind === "email" ? "email" : "notes",
      type: `note_${n.kind}`,
      title: NOTE_KIND_LABELS[n.kind],
      body: n.body,
      actor: n.author,
    });
  }

  // Emails sent from the CRM also come back from Outlook, so the log entry is only kept
  // when Outlook has nothing for this lead.
  const hasOutlookMail = emails.length > 0;
  for (const a of activitiesResult.data ?? []) {
    if (a.type === "email_sent" && hasOutlookMail) continue;
    items.push({
      id: `activity-${a.id}`,
      at: a.created_at,
      category: ACTIVITY_CATEGORY[a.type] ?? "system",
      type: a.type,
      title: ACTIVITY_TITLE[a.type] ?? "Activity",
      body: a.body,
      actor: who(a.actor_id),
    });
  }

  for (const e of emails) {
    items.push({
      id: `email-${e.id}`,
      at: e.sentAt,
      category: "email",
      type: e.direction === "inbound" ? "email_in" : "email_out",
      title: e.direction === "inbound" ? `Email from ${e.fromName || e.fromEmail || "contact"}` : `Email to ${e.contacts.map((c) => c.name).join(", ") || e.to.join(", ")}`,
      body: `${e.subject}${e.preview ? ` — ${e.preview}` : ""}`,
      href: "/communication",
    });
  }

  for (const m of meetings) {
    items.push({
      id: `meeting-${m.id}`,
      at: m.startsAt,
      category: "calls",
      type: "meeting",
      title: new Date(m.startsAt).getTime() > Date.now() ? "Upcoming meeting" : "Meeting",
      body: [m.subject, m.location].filter(Boolean).join(" · "),
    });
  }

  for (const c of calls) {
    items.push({
      id: `discovery-${c.id}`,
      at: `${c.callDate}T12:00:00Z`,
      category: "discovery",
      type: "discovery",
      title: `Discovery call · ${Math.round(c.score)}% of the canvas`,
      body: [c.prospectName, c.recommendedEntry ? `Entry point: ${c.recommendedEntry}` : null].filter(Boolean).join(" · ") || null,
      href: `/leads/${leadId}/discovery/${c.id}`,
    });
  }

  for (const r of registrations) {
    if (!r.checkedInAt) continue;
    items.push({
      id: `attended-${r.id}`,
      at: r.checkedInAt,
      category: "events",
      type: "event_attended",
      title: `Attended ${r.eventTitle}`,
      body: r.attendeeName,
      href: `/events/${r.eventId}`,
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return {
    notes,
    items: items.map((item) => ({ ...item, timeLabel: timeFormat.format(new Date(item.at)), dayLabel: dayLabel(item.at) })),
  };
}
