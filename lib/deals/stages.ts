import type { DealPayment, DealStage } from "@/lib/supabase/types";

export const DEAL_STAGES: DealStage[] = ["in_development", "sent", "accepted", "declined"];

export const OPEN_DEAL_STAGES: DealStage[] = ["in_development", "sent"];

export const DEAL_STAGE_META: Record<DealStage, { label: string; short: string; defaultProbability: number; accent: string; pill: string; header: string }> = {
  in_development: {
    label: "Proposal in Development",
    short: "In Development",
    defaultProbability: 25,
    accent: "bg-sky-500",
    pill: "bg-sky-50 text-sky-800",
    header: "bg-sky-50 border-sky-100",
  },
  sent: {
    label: "Proposal Sent",
    short: "Sent",
    defaultProbability: 50,
    accent: "bg-amber-500",
    pill: "bg-amber-50 text-amber-800",
    header: "bg-amber-50 border-amber-100",
  },
  accepted: {
    label: "Proposal Accepted",
    short: "Accepted",
    defaultProbability: 100,
    accent: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-800",
    header: "bg-emerald-50 border-emerald-100",
  },
  declined: {
    label: "Proposal Declined",
    short: "Declined",
    defaultProbability: 0,
    accent: "bg-rose-400",
    pill: "bg-rose-50 text-rose-800",
    header: "bg-rose-50 border-rose-100",
  },
};

export const PAYMENT_LABELS: Record<DealPayment, string> = { paid: "Paid", unpaid: "Unpaid" };

export function isDealStage(value: unknown): value is DealStage {
  return DEAL_STAGES.includes(value as DealStage);
}

/** The proposal's own probability if set, else the stage's default. */
export function effectiveProbability(stage: DealStage, probability: number | null): number {
  if (stage === "accepted" || stage === "declined") return DEAL_STAGE_META[stage].defaultProbability;
  return probability ?? DEAL_STAGE_META[stage].defaultProbability;
}

/** Roles in the buying committee. A proposal with no decision maker named is flagged. */
export const COMMITTEE_ROLES = [
  ["decision_maker", "Decision maker", "Signs off and controls the budget"],
  ["champion", "Champion", "Wants this to happen and pushes it inside"],
  ["finance", "Finance", "Approves the spend"],
  ["technical", "Technical", "Checks it will work for them"],
  ["end_user", "End user", "Will use what we deliver"],
  ["blocker", "Blocker", "Against it, or has a reason to slow it"],
  ["other", "Other", "Involved some other way"],
] as const;
export type CommitteeRole = (typeof COMMITTEE_ROLES)[number][0];
export const COMMITTEE_LABELS: Record<string, string> = Object.fromEntries(COMMITTEE_ROLES.map(([k, l]) => [k, l]));

export const DECLINED_BY = [
  ["them", "They declined"],
  ["us", "We declined"],
] as const;
export type DeclinedBy = (typeof DECLINED_BY)[number][0];

/** Reasons for each side. Keys are stored; never change one, add new ones instead. */
export const DECLINED_REASONS: Record<DeclinedBy, readonly (readonly [string, string])[]> = {
  them: [
    ["price", "Price too high"],
    ["timing", "Not the right time"],
    ["no_budget", "No budget"],
    ["chose_another", "Chose another provider"],
    ["no_decision", "Couldn't get a decision"],
    ["went_quiet", "Went quiet"],
    ["other", "Other"],
  ],
  us: [
    ["not_a_fit", "Not a fit for us"],
    ["capacity", "No capacity to take it on"],
    ["other", "Other"],
  ],
};
export const DECLINED_REASON_LABELS: Record<string, string> = Object.fromEntries(
  [...DECLINED_REASONS.them, ...DECLINED_REASONS.us].map(([k, l]) => [k, l])
);
export function isDeclinedReason(by: string, reason: string): boolean {
  return by in DECLINED_REASONS && DECLINED_REASONS[by as DeclinedBy].some(([k]) => k === reason);
}
