/**
 * The Catapult Discovery Call Questionnaire (Business Model Canvas pilot v1). Questions are
 * asked as written so every call is comparable. Ids are stored with each call's notes, so
 * never change an id; add new ones instead.
 */

export type Question = { id: string; text: string; probe: string; ip?: boolean };
export type Section = { id: string; title: string; questions: Question[]; bmc: boolean };

/** The 9 BMC blocks, in the canvas order used for scoring. */
export const BMC_BLOCKS = [
  "customer_segments",
  "value_propositions",
  "channels",
  "revenue_streams",
  "customer_relationships",
  "key_activities",
  "key_resources",
  "key_partners",
  "cost_structure",
] as const;
export type BmcBlock = (typeof BMC_BLOCKS)[number];

export type BlockStatus = "complete" | "partial" | "unknown";
export const BLOCK_STATUS_LABELS: Record<BlockStatus, string> = { complete: "Complete", partial: "Partial", unknown: "Unknown" };
const BLOCK_POINTS: Record<BlockStatus, number> = { complete: 1, partial: 0.5, unknown: 0 };

/** Who on the team owns follow-up for each block. */
export const BLOCK_OWNERS: Record<BmcBlock, string> = {
  customer_segments: "Steve",
  value_propositions: "Steve",
  channels: "Steve",
  revenue_streams: "Daniel",
  customer_relationships: "Jesse",
  key_activities: "Jesse",
  key_resources: "Daniel",
  key_partners: "Daniel",
  cost_structure: "Daniel",
};

export const SECTIONS: Section[] = [
  {
    id: "customer_segments",
    title: "Customer Segments",
    bmc: true,
    questions: [
      { id: "q1", text: "Who buys from you today? Describe your best customer.", probe: "Who signs the cheque on their side?" },
      { id: "q2", text: "Which customers bring in most of your revenue?", probe: "Is that the group you want more of?" },
      { id: "q3", text: "Who do you want to sell to next that you don't reach today?", probe: "What makes you think they'll buy?" },
    ],
  },
  {
    id: "value_propositions",
    title: "Value Propositions",
    bmc: true,
    questions: [
      { id: "q4", text: "What problem do you solve for that customer?", probe: "What would they do if you didn't exist?" },
      { id: "q5", text: "Why do customers pick you over the alternatives?", probe: "What do they say when they refer you?" },
      { id: "q6", text: "What do you make or do that others can't easily copy?", probe: "Is any of it protected — patent, trademark, industrial design, trade secret?", ip: true },
    ],
  },
  {
    id: "channels",
    title: "Channels",
    bmc: true,
    questions: [
      { id: "q7", text: "Where do most new customers come from today?", probe: "Roughly how much is referral, outbound, online, events?" },
      { id: "q8", text: "How does a sale happen, from first contact to signed deal?", probe: "How long does that usually take?" },
      { id: "q9", text: "Which channel would you put more money into if you could?", probe: "What's stopped you so far?" },
    ],
  },
  {
    id: "expansion",
    title: "Expansion Module",
    bmc: false,
    questions: [
      { id: "q27", text: "Which market do you want to enter, and who exactly do you want to reach there?", probe: "Same type of buyer as at home, or different?" },
      {
        id: "q28",
        text: "How do you plan to reach them — your own sales team, a local sales agent, partnering with a local builder or distributor, or licensing?",
        probe: "Have you spoken to anyone in that market yet?",
      },
      { id: "q29", text: "How much market research have you done?", probe: "What surprised you?" },
      { id: "q30", text: "Is your design, process or brand protected in that market?", probe: "Would licensing make more sense than shipping product?", ip: true },
      {
        id: "q31",
        text: "Are you aware of any government services that help de-risk expansion?",
        probe: "Have you used any? (Ask open-ended. Do not name specific agencies.)",
      },
    ],
  },
  {
    id: "revenue_streams",
    title: "Revenue Streams",
    bmc: true,
    questions: [
      { id: "q10", text: "How do you make money — one-off, recurring, project, wholesale, licensing?", probe: "Which of those is growing?" },
      { id: "q11", text: "Roughly what are you doing annually?", probe: "What's a typical deal or order size?" },
      { id: "q12", text: "How do you set your prices?", probe: "Do you earn, or could you earn, licensing or royalty income from anything you own?", ip: true },
    ],
  },
  {
    id: "customer_relationships",
    title: "Customer Relationships",
    bmc: true,
    questions: [
      { id: "q13", text: "What happens after a customer buys?", probe: "Do they come back or refer others?" },
      { id: "q14", text: "Who owns the customer relationship on your side?", probe: "What breaks when that person is away?" },
    ],
  },
  {
    id: "key_activities",
    title: "Key Activities",
    bmc: true,
    questions: [
      { id: "q15", text: "What does your team do every week that keeps the business running?", probe: "Which of those is the bottleneck?" },
      { id: "q16", text: "Where is the business losing time or money?", probe: "Can you put a dollar or hours figure on it?" },
      { id: "q17", text: "Which of your processes are unique to you?", probe: "Are they written down, and could any be protected?", ip: true },
    ],
  },
  {
    id: "key_resources",
    title: "Key Resources",
    bmc: true,
    questions: [
      { id: "q18", text: "How many people do you have, and in what roles?", probe: "Which role do you need next?" },
      { id: "q19", text: "What assets matter most — equipment, designs, software, brand, data?", probe: "Who owns them — the company, a founder, or a contractor?", ip: true },
      { id: "q20", text: "What's the ownership structure of the business?", probe: "Any partners or investors with a say?" },
    ],
  },
  {
    id: "key_partners",
    title: "Key Partners",
    bmc: true,
    questions: [
      { id: "q21", text: "Who do you rely on outside the company — suppliers, manufacturers, distributors?", probe: "What happens if one of them drops out?" },
      { id: "q22", text: "Which advisors do you already have — bookkeeper, accountant, lawyer?", probe: "Is anyone handling your IP?" },
    ],
  },
  {
    id: "cost_structure",
    title: "Cost Structure",
    bmc: true,
    questions: [
      { id: "q23", text: "What are your biggest costs?", probe: "Which are fixed, and which grow with volume?" },
      { id: "q24", text: "What will it cost to get to the next stage?", probe: "How do you plan to fund it — cash flow, line of credit, investors, grants?" },
    ],
  },
  {
    id: "always_ask",
    title: "Always Ask",
    bmc: false,
    questions: [
      { id: "q25", text: "Have you worked with a consultant, fractional executive, or paid advisor before? How did it go?", probe: "What would you want done differently next time?" },
      { id: "q26", text: "What's your budget for solving this, and by when does it need to be solved?", probe: "Who else signs off on something like this?" },
    ],
  },
];

export const QUESTION_IDS = new Set(SECTIONS.flatMap((s) => s.questions.map((q) => q.id)));

export const FLAGS = [
  ["no_cost", "Couldn't name a cost"],
  ["no_timeline", "No timeline"],
  ["decision_maker_absent", "Decision maker absent"],
  ["no_budget", "No budget"],
  ["deflected_to_proposal", "Deflected to a proposal"],
  ["no_customer", "Couldn't describe their customer"],
] as const;
export type Flag = (typeof FLAGS)[number][0];

export const ENTRY_POINTS = [
  "Velocity",
  "Launch",
  "Apex",
  "ETA",
  "Advisory Pass",
  "Intro Assessment",
  "IP Commercialization Support",
  "Single service",
  "Refer out",
] as const;

export const CONSULTANT_EXPERIENCE = [
  ["good", "Good"],
  ["bad", "Bad"],
  ["none", "None"],
  ["unknown", "Unknown"],
] as const;
export type ConsultantExperience = (typeof CONSULTANT_EXPERIENCE)[number][0];

export function isBlockStatus(value: unknown): value is BlockStatus {
  return value === "complete" || value === "partial" || value === "unknown";
}

/** Completion %: Complete = 1, Partial = 0.5, Unknown or unmarked = 0, over the 9 blocks. */
export function completionScore(status: Partial<Record<string, BlockStatus>>): number {
  const points = BMC_BLOCKS.reduce((sum, block) => sum + BLOCK_POINTS[status[block] ?? "unknown"], 0);
  return Math.round((points / BMC_BLOCKS.length) * 1000) / 10;
}

/** A starting suggestion from how many of the block's questions have notes. */
export function suggestBlockStatus(block: BmcBlock, answers: Record<string, string>): BlockStatus {
  const questions = SECTIONS.find((s) => s.id === block)!.questions;
  const answered = questions.filter((q) => answers[q.id]?.trim()).length;
  if (answered === 0) return "unknown";
  return answered === questions.length ? "complete" : "partial";
}

export type Route = { key: "advisory" | "touchpoint" | "proposal_ready" | "successful"; label: string; detail: string; tone: string };

/** Pilot thresholds; these will be adjusted. */
export function routeFor(score: number): Route {
  if (score < 25) return { key: "advisory", label: "Advisory Pass", detail: "Self-directed resources, newsletter and events.", tone: "bg-slate-100 text-slate-800" };
  if (score < 50) return { key: "touchpoint", label: "Another discovery touchpoint", detail: "One more conversation before any proposal.", tone: "bg-amber-50 text-amber-900" };
  if (score < 75) return { key: "proposal_ready", label: "Proposal-ready", detail: "Reasonable chance to close.", tone: "bg-sky-50 text-sky-900" };
  return { key: "successful", label: "Successful discovery", detail: "Full Velocity proposal.", tone: "bg-emerald-50 text-emerald-900" };
}

export const APEX_THRESHOLD = 60;

export function blockTitle(block: string): string {
  return SECTIONS.find((s) => s.id === block)?.title ?? block;
}
