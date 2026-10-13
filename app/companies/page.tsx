import Link from "next/link";
import { getCompaniesList } from "@/lib/companies/queries";
import { StatusPill } from "@/components/status-pill";

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
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">
            {companies.length} compan{companies.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <form action="/companies" className="w-full max-w-xs">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search companies…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
          />
        </form>
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                  <Link href={`/companies/${c.id}`} className="hover:underline">
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
