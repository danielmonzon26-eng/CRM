/** Topics on the feedback form. Keys are stored with each response; never change a key. */
export const FEEDBACK_TOPICS = [
  ["ip", "Intellectual property & patents"],
  ["capital", "Raising capital & investors"],
  ["grants", "Grants & government programs"],
  ["sales_marketing", "Sales & marketing"],
  ["hiring", "Hiring & building a team"],
  ["operations", "Operations & automation"],
  ["ai", "AI for your business"],
  ["export", "Exporting & new markets"],
  ["exit", "Exit & succession planning"],
  ["finance", "Financial planning & cash flow"],
] as const;

export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number][0];
export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(FEEDBACK_TOPICS);

export const FOLLOW_UP_LABELS: Record<string, string> = { yes: "Yes, please", maybe: "Maybe later", no: "No thanks" };

export type FeedbackResponse = {
  id: string;
  name: string | null;
  email: string | null;
  satisfaction: number;
  recommend: number;
  topics: string[];
  mostValuable: string | null;
  improve: string | null;
  followUp: string | null;
  submittedAt: string;
  submittedLabel: string;
  leadId: string | null;
};

export type FeedbackSummary = {
  requested: number;
  sentCount: number;
  failedCount: number;
  responses: FeedbackResponse[];
  responseRate: number | null;
  avgSatisfaction: number | null;
  avgRecommend: number | null;
  /** Net Promoter Score: % who'd recommend 9-10 minus % who'd give 1-6. */
  nps: number | null;
  satisfactionCounts: number[];
  recommendCounts: number[];
  topicCounts: { key: string; label: string; count: number }[];
  followUps: FeedbackResponse[];
};

export function summarizeFeedback(
  rows: { id: string; requestSentAt: string | null; sendError: string | null; response: FeedbackResponse | null }[]
): FeedbackSummary {
  const responses = rows.map((r) => r.response).filter((r): r is FeedbackResponse => r !== null);
  const sentCount = rows.filter((r) => r.requestSentAt).length;
  const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);
  const counts = (values: number[]) => Array.from({ length: 10 }, (_, i) => values.filter((v) => v === i + 1).length);
  const recommend = responses.map((r) => r.recommend);
  const promoters = recommend.filter((v) => v >= 9).length;
  const detractors = recommend.filter((v) => v <= 6).length;

  return {
    requested: rows.length,
    sentCount,
    failedCount: rows.filter((r) => r.sendError && !r.requestSentAt).length,
    responses: responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    responseRate: sentCount ? Math.round((responses.length / sentCount) * 100) : null,
    avgSatisfaction: avg(responses.map((r) => r.satisfaction)),
    avgRecommend: avg(recommend),
    nps: recommend.length ? Math.round(((promoters - detractors) / recommend.length) * 100) : null,
    satisfactionCounts: counts(responses.map((r) => r.satisfaction)),
    recommendCounts: counts(recommend),
    topicCounts: FEEDBACK_TOPICS.map(([key, label]) => ({ key, label, count: responses.filter((r) => r.topics.includes(key)).length })).sort(
      (a, b) => b.count - a.count
    ),
    followUps: responses.filter((r) => r.followUp === "yes" || r.followUp === "maybe"),
  };
}
