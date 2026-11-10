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
