export const CLIENT_TYPES = [
  ["government", "Government"],
  ["private_business", "Private Business"],
  ["small_business", "Small Business"],
  ["medium_business", "Medium Business"],
  ["start_up", "Start Up"],
] as const;

export const LEAD_PROGRAMS = [
  ["events_education", "Events & Education"],
  ["catapult_ready", "Catapult Ready Program"],
  ["capital_raise", "Capital Raise"],
  ["company_exit", "Company Exit"],
  ["ip_programs", "IP Programs"],
  ["revenue_growth", "Revenue Growth"],
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number][0];
export type LeadProgram = (typeof LEAD_PROGRAMS)[number][0];

const CLIENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(CLIENT_TYPES);
const PROGRAM_LABELS: Record<string, string> = Object.fromEntries(LEAD_PROGRAMS);

export function clientTypeLabel(value: string | null | undefined): string | null {
  return value ? CLIENT_TYPE_LABELS[value] ?? value : null;
}

export function programLabel(value: string): string {
  return PROGRAM_LABELS[value] ?? value;
}

export function isClientType(value: unknown): value is ClientType {
  return CLIENT_TYPES.some(([key]) => key === value);
}

export function isLeadProgram(value: unknown): value is LeadProgram {
  return LEAD_PROGRAMS.some(([key]) => key === value);
}
