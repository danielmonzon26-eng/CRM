import Link from "next/link";
import { Search } from "lucide-react";
import { getContactsList } from "@/lib/contacts/queries";
import { EngagementPill, StatusPill } from "@/components/status-pill";
import { clientTypeLabel } from "@/lib/leads/classification";
import { ALL_ENGAGEMENTS, ENGAGEMENT_LABELS, isLeadEngagement } from "@/lib/leads/filters";
import { getInitials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const activeStatus = isLeadEngagement(status) ? status : null;
  const everyone = await getContactsList(q);
  const contacts = activeStatus ? everyone.filter((c) => c.engagement === activeStatus) : everyone;
  const tabHref = (value: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("status", value);
    const query = params.toString();
    return query ? `/contacts?${query}` : "/contacts";
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-[2.125rem] text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            Everyone at every company. Engaged companies also appear under Leads.
          </p>
        </div>
        <form action="/contacts" className="relative w-full max-w-xs">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email…"
            aria-label="Search contacts"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </header>

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {[null, ...ALL_ENGAGEMENTS].map((value) => {
          const count = value ? everyone.filter((c) => c.engagement === value).length : everyone.length;
          const active = activeStatus === value;
          return (
            <Link
              key={value ?? "all"}
              href={tabHref(value)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {value ? ENGAGEMENT_LABELS[value] : "All"} <span className="text-xs font-normal text-slate-400">{count.toLocaleString()}</span>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Client type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
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
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{clientTypeLabel(c.clientType) ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <EngagementPill engagement={c.engagement} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={c.status} />
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
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
