import Link from "next/link";
import { getContactsList } from "@/lib/contacts/queries";
import { StatusPill } from "@/components/status-pill";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const contacts = await getContactsList(q);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </p>
        </div>
        <form action="/contacts" className="w-full max-w-xs">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
          />
        </form>
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                  <Link href={`/leads/${c.leadId}`} className="hover:underline">
                    {c.fullName}
                  </Link>
                  {c.isPrimary && (
                    <span className="ml-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">Primary</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.title ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  <Link href={`/companies/${c.companyId}`} className="hover:underline">
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
