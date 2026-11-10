import { isClientType, isLeadProgram } from "@/lib/leads/classification";
import { ALL_STATUSES, isLeadEngagement } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

/** What the quick edit form holds. An empty string means the field is blank. */
export type QuickEditValues = {
  status: LeadStatus;
  engagement: LeadEngagement;
  clientType: string;
  programs: string[];
  companyName: string;
  industry: string;
  community: string;
  website: string;
  companyPhone: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
};

export type QuickEditChanges = Partial<QuickEditValues>;

export type QuickEditRecord = {
  leadId: string;
  contactId: string | null;
  otherContacts: number;
  values: QuickEditValues;
};

export const COMPANY_FIELD_LABELS = {
  companyName: "name",
  industry: "industry",
  community: "community",
  website: "website",
  companyPhone: "phone",
} as const;

export const CONTACT_FIELD_LABELS = {
  contactName: "name",
  contactTitle: "title",
  contactEmail: "email",
  contactPhone: "phone",
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only what someone actually changed, so a save can't undo a teammate's edit to another field. */
export function getQuickEditChanges(before: QuickEditValues, after: QuickEditValues): QuickEditChanges {
  const changes: Record<string, string | string[]> = {};
  for (const key of Object.keys(before) as (keyof QuickEditValues)[]) {
    const previous = before[key];
    const next = after[key];
    if (Array.isArray(previous) && Array.isArray(next)) {
      if ([...previous].sort().join() !== [...next].sort().join()) changes[key] = next;
    } else if (typeof next === "string" && next.trim() !== previous) {
      changes[key] = next.trim();
    }
  }
  return changes;
}

/** Website links open straight from the lead page, so only real http(s) addresses are kept. */
function cleanWebsite(value: string): string | null {
  if (!value) return "";
  const address = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(address);
    return url.hostname.includes(".") && !url.username ? address : null;
  } catch {
    return null;
  }
}

export function checkQuickEditChanges(changes: QuickEditChanges, hasContact: boolean): { error: string } | { changes: QuickEditChanges } {
  if (changes.status && !ALL_STATUSES.includes(changes.status)) return { error: "That isn't a valid stage." };
  if (changes.engagement && !isLeadEngagement(changes.engagement)) return { error: "That isn't a valid status." };
  if (changes.clientType && !isClientType(changes.clientType)) return { error: "That isn't a valid client type." };
  if (changes.programs && !changes.programs.every(isLeadProgram)) return { error: "That isn't a valid type of work." };
  if (changes.companyName === "") return { error: "Add a company name." };
  if (changes.contactEmail && !EMAIL_PATTERN.test(changes.contactEmail)) return { error: "Check the contact's email address." };

  const contactChanged = (Object.keys(CONTACT_FIELD_LABELS) as (keyof typeof CONTACT_FIELD_LABELS)[]).some((key) => changes[key]);
  if (changes.contactName === "" || (!hasContact && contactChanged && !changes.contactName)) return { error: "Add a name for the contact." };

  if (changes.website === undefined) return { changes };
  const website = cleanWebsite(changes.website);
  if (website === null) return { error: "Check the website address." };
  return { changes: { ...changes, website } };
}
