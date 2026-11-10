export const CLIENT_TYPES = [
  ["government", "Government"],
  ["non_profit", "Non Profit"],
  ["private", "Private"],
] as const;

/** The work Catapult does, chosen per lead (stored in leads.programs). */
export const LEAD_PROGRAMS = [
  ["elevate_ip", "Elevate IP"],
  ["education", "Education"],
  ["operations_assistance", "Operations Assistance"],
  ["capital", "Capital"],
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
