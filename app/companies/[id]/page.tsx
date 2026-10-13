import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyDetail } from "@/lib/companies/queries";
import { getContactsList } from "@/lib/contacts/queries";
import { getTasksForSubject } from "@/lib/tasks/queries";
import { TaskList } from "@/components/task-list";
import { TaskForm } from "@/components/task-form";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompanyDetail(id);
  if (!company) notFound();

  const [allContacts, tasks] = await Promise.all([
    getContactsList(),
    getTasksForSubject({ companyId: id, leadId: company.leadId ?? undefined }),
  ]);
  const contacts = allContacts.filter((c) => c.companyId === id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/companies" className="text-sm text-slate-500 hover:underline">
        ← Back to companies
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
          <p className="text-sm text-slate-500">
            {company.address_line ?? "No address on file"} · {company.community ?? company.city}
          </p>
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              {company.website}
            </a>
          )}
        </div>
        {company.leadId && (
          <Link
            href={`/leads/${company.leadId}`}
            className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            View deal →
          </Link>
        )}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Industry" value={company.industry} />
        <Field label="Phone" value={company.phone} />
        <Field label="Postal code" value={company.postal_code} />
        <Field
          label="Est. annual revenue"
          value={company.estimated_annual_revenue != null ? `$${company.estimated_annual_revenue.toLocaleString()}` : null}
        />
        <Field label="NAICS code" value={company.naics_code} />
        <Field label="First seen" value={new Date(company.created_at).toLocaleDateString()} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-700">Contacts ({contacts.length})</h2>
        <div className="mt-2 space-y-2">
          {contacts.length === 0 && <p className="text-sm text-slate-400">No contacts on file.</p>}
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={`/leads/${c.leadId}`}
              className="block rounded-md border border-slate-200 bg-white p-3 hover:border-slate-300"
            >
              <p className="flex items-center gap-2 font-medium text-slate-900">
                {c.fullName}
                {c.isPrimary && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">Primary</span>
                )}
              </p>
              <p className="text-xs text-slate-500">{c.title ?? "Unknown title"}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {c.email && <span>{c.email}</span>}
                {c.phone && <span>{c.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-700">Tasks</h2>
        <div className="mt-2">
          <TaskForm leadId={company.leadId} companyId={company.leadId ? undefined : company.id} />
        </div>
        <div className="mt-4">
          <TaskList tasks={tasks} />
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value ?? "—"}</p>
    </div>
  );
}
