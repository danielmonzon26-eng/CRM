import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { getLeadsTable } from "@/lib/leads/queries";
import { StatusPill } from "@/components/status-pill";
import { ScoreBadge } from "@/components/score-badge";
import { getInitials } from "@/lib/text";
import type { LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_TABS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "researching", label: "Researching" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "unqualified", label: "Unqualified" },
];

function buildHref(params: { q?: string; status?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export default async function LeadsTablePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageParam } = await searchParams;
  const activeStatus = (STATUS_TABS.some((t) => t.value === status) ? status : "all") as LeadStatus | "all";
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows, total } = await getLeadsTable({ search: q, status: activeStatus, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} total leads</p>
        </div>
        <form action="/leads" className="relative w-full max-w-xs">
          {activeStatus !== "all" && <input type="hidden" name="status" value={activeStatus} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search companies…"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </header>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref({ q, status: tab.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeStatus === tab.value
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Decision-maker</th>
              <th className="px-4 py-2.5 font-medium">Industry</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Fit score</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5 hover:text-brand-700">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {getInitials(lead.companyName) || <Building2 className="h-3.5 w-3.5" />}
                    </span>
                    {lead.companyName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {lead.primaryContact ? (
                    <>
                      {lead.primaryContact.fullName}
                      {lead.primaryContact.title && (
                        <span className="text-slate-400"> · {lead.primaryContact.title}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.industry ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{lead.community ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={lead.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No leads match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {start}–{end} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({ q, status: activeStatus, page: page - 1 })}
              aria-disabled={page <= 1}
              className={`rounded-md border border-slate-200 px-3 py-1.5 font-medium ${
                page <= 1 ? "pointer-events-none opacity-40" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Previous
            </Link>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Link
              href={buildHref({ q, status: activeStatus, page: page + 1 })}
              aria-disabled={page >= totalPages}
              className={`rounded-md border border-slate-200 px-3 py-1.5 font-medium ${
                page >= totalPages ? "pointer-events-none opacity-40" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
