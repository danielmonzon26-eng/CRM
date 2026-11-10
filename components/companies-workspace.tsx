"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, ChevronLeft, ChevronRight, SearchX, X } from "lucide-react";
import { CompanyExport } from "@/components/company-export";
import { MakeLeadButton } from "@/components/make-lead-button";
import { EngagementPill, StatusPill } from "@/components/status-pill";
import { buttonClass } from "@/components/ui/button";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { EmptyState, PageHeader } from "@/components/ui/page";
import type { CompanyListRow } from "@/lib/companies/queries";
import { FILTERS_CLEARED, type CompanySort, type CompanyView } from "@/lib/companies/view";
import { industryOptions, matchesIndustryFilter, parseIndustry } from "@/lib/industries/naics";
import { CLIENT_TYPES, LEAD_PROGRAMS, clientTypeLabel, programLabel } from "@/lib/leads/classification";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/leads/filters";
import { getInitials } from "@/lib/text";
import type { LeadStatus } from "@/lib/supabase/types";

const PAGE_SIZE = 50;
// Catapult Ready's revenue requirement, matching the lead scoring.
const QUALIFYING_REVENUE = 2_000_000;

const CONTACT_LABELS: Record<string, string> = { has: "Has contacts", none: "No contacts" };
const REVENUE_LABELS: Record<string, string> = { qualifying: "$2M or more", known: "Revenue known", unknown: "Revenue unknown" };
function viewToQuery(view: CompanyView): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(FILTERS_CLEARED) as (keyof typeof FILTERS_CLEARED)[]) {
    if (view[key]) params.set(key, view[key]);
  }
  if (view.sort !== "name") params.set("sort", view.sort);
  if (view.desc) params.set("desc", "1");
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function matches(company: CompanyListRow, view: CompanyView, terms: string[]): boolean {
  if (!terms.every((term) => company.searchText.includes(term))) return false;
  if (view.status === "none" ? company.status !== null : view.status && company.status !== view.status) return false;
  if (view.clientType === "none" ? company.clientType !== null : view.clientType && company.clientType !== view.clientType) return false;
  if (view.program === "none" ? company.programs.length > 0 : view.program && !company.programs.includes(view.program)) return false;
  if (view.industry === "none" ? company.industry !== null : view.industry && !matchesIndustryFilter(company.industry, view.industry)) return false;
  if (view.community === "none" ? company.community !== null : view.community && company.community !== view.community) return false;
  if (view.contact === "has" && company.contactCount === 0) return false;
  if (view.contact === "none" && company.contactCount > 0) return false;
  const revenue = company.estimatedAnnualRevenue;
  if (view.revenue === "qualifying" && (revenue ?? 0) < QUALIFYING_REVENUE) return false;
  if (view.revenue === "known" && revenue === null) return false;
  if (view.revenue === "unknown" && revenue !== null) return false;
  return true;
}

/** Blanks always sort last, whichever way the column is sorted. */
function compareCompanies(a: CompanyListRow, b: CompanyListRow, sort: CompanySort, desc: boolean): number {
  const value = (c: CompanyListRow): string | number | null => {
    if (sort === "community") return c.community?.toLowerCase() ?? null;
    if (sort === "industry") return c.industry?.toLowerCase() ?? null;
    if (sort === "revenue") return c.estimatedAnnualRevenue;
    if (sort === "contacts") return c.contactCount;
    if (sort === "status") return c.status;
    return c.name.toLowerCase();
  };
  const [x, y] = [value(a), value(b)];
  if (x === y) return a.name.localeCompare(b.name);
  if (x === null) return 1;
  if (y === null) return -1;
  const order = x < y ? -1 : 1;
  return desc ? -order : order;
}

function IndustryCell({ industry }: { industry: string | null }) {
  const parts = parseIndustry(industry);
  if (!parts) return <>{industry ?? "—"}</>;
  return (
    <>
      <span className="block text-slate-800">{parts.subsector}</span>
      <span className="block text-xs text-slate-500">{parts.sector}</span>
    </>
  );
}

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
}

export function CompaniesWorkspace({ companies, initial }: { companies: CompanyListRow[]; initial: CompanyView }) {
  const [view, setView] = useState(initial);

  const update = (patch: Partial<CompanyView>) => setView((current) => ({ ...current, page: 1, ...patch }));

  // Keeps the address in step, so a filtered list can be refreshed, bookmarked, or shared.
  useEffect(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${viewToQuery(view)}`);
  }, [view]);

  const industries = useMemo(() => distinct(companies.map((c) => c.industry)), [companies]);
  const communities = useMemo(() => distinct(companies.map((c) => c.community)), [companies]);

  const filtered = useMemo(() => {
    const terms = view.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return companies.filter((c) => matches(c, view, terms)).sort((a, b) => compareCompanies(a, b, view.sort, view.desc));
  }, [companies, view]);

  const lastPage = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const page = Math.min(view.page, lastPage);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chips: { label: string; clear: Partial<CompanyView> }[] = [
    ...(view.q ? [{ label: `Search: ${view.q}`, clear: { q: "" } }] : []),
    ...(view.status ? [{ label: `Stage: ${view.status === "none" ? "No lead" : STATUS_LABELS[view.status as LeadStatus]}`, clear: { status: "" } }] : []),
    ...(view.clientType ? [{ label: `Client type: ${view.clientType === "none" ? "Not set" : clientTypeLabel(view.clientType)}`, clear: { clientType: "" } }] : []),
    ...(view.program ? [{ label: `Work: ${view.program === "none" ? "None selected" : programLabel(view.program)}`, clear: { program: "" } }] : []),
    ...(view.industry ? [{ label: `Industry: ${view.industry === "none" ? "Not set" : view.industry.replace("sector:", "")}`, clear: { industry: "" } }] : []),
    ...(view.community ? [{ label: `Community: ${view.community === "none" ? "Not set" : view.community}`, clear: { community: "" } }] : []),
    ...(view.contact ? [{ label: CONTACT_LABELS[view.contact], clear: { contact: "" } }] : []),
    ...(view.revenue ? [{ label: REVENUE_LABELS[view.revenue], clear: { revenue: "" } }] : []),
  ];

  const SortHeader = ({ label, sort }: { label: string; sort: CompanySort }) => {
    const active = view.sort === sort;
    const Icon = active ? (view.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th scope="col" aria-sort={active ? (view.desc ? "descending" : "ascending") : "none"} className="px-4 py-2 font-medium">
        <button
          type="button"
          onClick={() => update({ sort, desc: active ? !view.desc : sort === "revenue" || sort === "contacts" })}
          className={`inline-flex min-h-6 items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} strokeWidth={2} />
        </button>
      </th>
    );
  };

  return (
    <div>
      <PageHeader title="Companies" subtitle={`${companies.length.toLocaleString()} ${companies.length === 1 ? "company" : "companies"}`} actions={<><Link href="/companies/import-industries" className={buttonClass("secondary")}>Import industries</Link><CompanyExport /></>} />

      <SearchField
        className="mb-3"
        label="Search companies by keyword"
        placeholder="Search by company, industry, community, website, phone, address, or contact..."
        value={view.q}
        onChange={(q) => update({ q })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect label="Stage" value={view.status} onChange={(status) => update({ status })} options={[...ALL_STATUSES.map((s) => ({ value: s as string, label: STATUS_LABELS[s] })), { value: "none", label: "No lead" }]} />
        <FilterSelect label="Client type" value={view.clientType} onChange={(clientType) => update({ clientType })} options={[...CLIENT_TYPES.map(([value, label]) => ({ value: value as string, label })), { value: "none", label: "Not set" }]} />
        <FilterSelect label="Work" value={view.program} onChange={(program) => update({ program })} options={[...LEAD_PROGRAMS.map(([value, label]) => ({ value: value as string, label })), { value: "none", label: "None selected" }]} />
        <FilterSelect label="Industry" value={view.industry} onChange={(industry) => update({ industry })} options={[{ value: "none", label: "Not set" }, ...industryOptions(industries, { wholeSectors: true })]} />
        <FilterSelect label="Community" value={view.community} onChange={(community) => update({ community })} options={[...communities.map((c) => ({ value: c, label: c })), { value: "none", label: "Not set" }]} />
        <FilterSelect label="Contacts" value={view.contact} allLabel="Any" onChange={(contact) => update({ contact })} options={[{ value: "has", label: "Has contacts" }, { value: "none", label: "No contacts" }]} />
        <FilterSelect label="Revenue" value={view.revenue} allLabel="Any" onChange={(revenue) => update({ revenue })} options={[{ value: "qualifying", label: "$2M or more" }, { value: "known", label: "Revenue known" }, { value: "unknown", label: "Revenue unknown" }]} />
      </div>

      <div className="mb-3 flex min-h-6 flex-wrap items-center gap-2 text-sm">
        <span aria-live="polite" className="font-medium text-slate-900">
          {filtered.length.toLocaleString()} {filtered.length === 1 ? "company" : "companies"}
        </span>
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => update(chip.clear)}
            aria-label={`Remove filter ${chip.label}`}
            className="inline-flex min-h-6 max-w-72 items-center gap-1 rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-medium text-slate-800 hover:bg-slate-300/70"
          >
            <span className="truncate">{chip.label}</span>
            <X className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          </button>
        ))}
        {chips.length > 1 && (
          <button type="button" onClick={() => update(FILTERS_CLEARED)} className="min-h-6 text-xs font-medium text-brand-700 hover:underline">Clear all</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No companies match"
          description="Try a different keyword or remove a filter."
          action={<button type="button" onClick={() => update(FILTERS_CLEARED)} className={buttonClass("secondary")}>Clear filters</button>}
        />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <SortHeader label="Company" sort="name" />
                  <SortHeader label="Community" sort="community" />
                  <SortHeader label="Industry" sort="industry" />
                  <SortHeader label="Est. revenue" sort="revenue" />
                  <SortHeader label="Contacts" sort="contacts" />
                  <SortHeader label="Stage" sort="status" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-900">
                      <Link href={`/companies/${c.id}`} className="flex items-center gap-2.5 hover:text-brand-700">
                        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500">
                          {getInitials(c.name) || <Building2 className="h-3.5 w-3.5" />}
                        </span>
                        {c.name}
                      </Link>
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">{c.community ?? "—"}</td>
                    <td className="max-w-80 px-4 py-2.5 text-slate-600"><IndustryCell industry={c.industry} /></td>
                    <td className="px-4 py-2.5 text-slate-600">{c.estimatedAnnualRevenue != null ? `$${c.estimatedAnnualRevenue.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.contactCount}</td>
                    <td className="px-4 py-2">
                      {c.engagement === "engaged" && c.status ? (
                        <StatusPill status={c.status} />
                      ) : c.engagement === "do_not_contact" ? (
                        <EngagementPill engagement="do_not_contact" />
                      ) : (
                        <MakeLeadButton companyId={c.id} companyName={c.name} size="sm" variant="secondary" stayOnPage />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>{((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
            <nav aria-label="Pages" className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => update({ page: page - 1 })} className={`${buttonClass("secondary", "sm")} disabled:opacity-40`}>
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                Previous
              </button>
              <span className="text-xs">Page {page} of {lastPage.toLocaleString()}</span>
              <button type="button" disabled={page >= lastPage} onClick={() => update({ page: page + 1 })} className={`${buttonClass("secondary", "sm")} disabled:opacity-40`}>
                Next
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
