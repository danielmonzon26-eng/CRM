import Link from "next/link";
import { Search } from "lucide-react";
import { getContactsList } from "@/lib/contacts/queries";
import { StatusPill } from "@/components/status-pill";
import { getInitials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const contacts = await getContactsList(q);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            {contacts.length.toLocaleString()} contact{contacts.length === 1 ? "" : "s"}
          </p>
        </div>
        <form action="/contacts" className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Deal status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <Link href={`/leads/${c.leadId}`} className="flex items-center gap-2.5 hover:text-brand-700">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                      {getInitials(c.fullName)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {c.fullName}
                      {c.isPrimary && (
                        <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">Primary</span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.title ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  <Link href={`/companies/${c.companyId}`} className="hover:text-brand-700 hover:underline">
                    {c.companyName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={c.status} />
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
