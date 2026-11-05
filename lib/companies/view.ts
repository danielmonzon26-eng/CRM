/** Which companies are showing. Read on the server for the first render, then kept in the browser. */
const SORTS = ["name", "community", "industry", "revenue", "contacts", "status"] as const;

export type CompanySort = (typeof SORTS)[number];
export type CompanyView = {
  q: string;
  status: string;
  clientType: string;
  program: string;
  industry: string;
  community: string;
  contact: string;
  revenue: string;
  sort: CompanySort;
  desc: boolean;
  page: number;
};

export const FILTERS_CLEARED = { q: "", status: "", clientType: "", program: "", industry: "", community: "", contact: "", revenue: "" };

export function parseCompanyView(params: Record<string, string | undefined>): CompanyView {
  return {
    q: params.q ?? "",
    status: params.status ?? "",
    clientType: params.clientType ?? "",
    program: params.program ?? "",
    industry: params.industry ?? "",
    community: params.community ?? "",
    contact: params.contact ?? "",
    revenue: params.revenue ?? "",
    sort: SORTS.includes(params.sort as CompanySort) ? (params.sort as CompanySort) : "name",
    desc: params.desc === "1",
    page: Math.max(Number(params.page) || 1, 1),
  };
}
