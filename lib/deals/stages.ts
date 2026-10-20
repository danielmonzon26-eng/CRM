import type { DealStage } from "@/lib/supabase/types";

export const DEAL_STAGES: DealStage[] = [
  "discovery_scheduled",
  "discovery_completed",
  "qualified_opportunity",
  "proposal_sent",
  "negotiation_decision",
  "closed_won",
  "closed_lost",
];

export const OPEN_DEAL_STAGES: DealStage[] = DEAL_STAGES.filter(
  (s) => s !== "closed_won" && s !== "closed_lost"
);

export const DEAL_STAGE_META: Record<DealStage, { label: string; defaultProbability: number; accent: string }> = {
  discovery_scheduled: { label: "Discovery Scheduled", defaultProbability: 10, accent: "bg-slate-400" },
  discovery_completed: { label: "Discovery Completed", defaultProbability: 20, accent: "bg-sky-500" },
  qualified_opportunity: { label: "Qualified Opportunity", defaultProbability: 40, accent: "bg-indigo-500" },
  proposal_sent: { label: "Proposal Sent", defaultProbability: 60, accent: "bg-amber-500" },
  negotiation_decision: { label: "Negotiation / Decision", defaultProbability: 80, accent: "bg-purple-500" },
  closed_won: { label: "Closed Won", defaultProbability: 100, accent: "bg-emerald-500" },
  closed_lost: { label: "Closed Lost", defaultProbability: 0, accent: "bg-rose-400" },
};

/** The deal's own probability if set, else the stage's configured default. */
export function effectiveProbability(stage: DealStage, probability: number | null): number {
  return probability ?? DEAL_STAGE_META[stage].defaultProbability;
}
