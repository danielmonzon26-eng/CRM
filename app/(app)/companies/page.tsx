import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { getCompaniesList } from "@/lib/companies/queries";
import { StatusPill } from "@/components/status-pill";
import { getInitials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const companies = await getCompaniesList(q);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">
            {companies.length.toLocaleString()} compan{companies.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <form action="/companies" className="relative w-full max-w-xs">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Community</th>
              <th className="px-4 py-2.5 font-medium">Industry</th>
              <th className="px-4 py-2.5 font-medium">Est. revenue</th>
              <th className="px-4 py-2.5 font-medium">Contacts</th>
              <th className="px-4 py-2.5 font-medium">Deal status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <Link href={`/companies/${c.id}`} className="flex items-center gap-2.5 hover:text-brand-700">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {getInitials(c.name) || <Building2 className="h-3.5 w-3.5" />}
                    </span>
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.community ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.industry ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {c.estimatedAnnualRevenue != null ? `$${c.estimatedAnnualRevenue.toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.contactCount}</td>
                <td className="px-4 py-2.5">{c.status ? <StatusPill status={c.status} /> : <span className="text-slate-400">No lead</span>}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
