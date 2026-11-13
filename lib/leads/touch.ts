/**
 * How recently someone at Catapult was in touch with a lead, worked out in the database
 * (the lead_touch view) from calls, meetings and email logged or synced, discovery calls
 * and event check-ins. These pure helpers turn it into what the Leads page shows.
 */

export const STALLED_DAYS = 14;
const DAY_MS = 86_400_000;

export type TouchHealth = "active" | "cooling" | "cold" | "never";

export function daysSince(at: string | null, now: Date = new Date()): number | null {
  if (!at) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / DAY_MS));
}

/** Active within 14 days, cooling within 30, cold after that, never if there's no touch. */
export function touchHealth(days: number | null): TouchHealth {
  if (days === null) return "never";
  if (days <= STALLED_DAYS) return "active";
  if (days <= 30) return "cooling";
  return "cold";
}

export function touchLabel(days: number | null): string {
  if (days === null) return "No contact yet";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export const HEALTH_DOT: Record<TouchHealth, string> = {
  active: "bg-emerald-500",
  cooling: "bg-amber-400",
  cold: "bg-rose-500",
  never: "bg-slate-300",
};

export const LEAD_VIEWS = [
  ["needs_me", "Needs me today", "Waiting on our reply, something overdue, or no contact in 14+ days"],
  ["all", "All leads", "Every lead under the filters below"],
  ["stalled", "Stalled", "No contact in 14+ days"],
  ["no_next_step", "No next step", "No open task and no next step on a proposal"],
  ["decision_month", "Decision this month", "A proposal decision expected this month"],
  ["low_bmc", "Low BMC", "Discovery call covered under half the canvas"],
] as const;
export type LeadView = (typeof LEAD_VIEWS)[number][0];

export function isLeadView(value: unknown): value is LeadView {
  return LEAD_VIEWS.some(([key]) => key === value);
}
