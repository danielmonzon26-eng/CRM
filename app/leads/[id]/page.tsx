import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusSelect } from "@/components/status-select";
import { getLeadDetail } from "@/lib/leads/queries";
import { NoteForm } from "./note-form";

export const dynamic = "force-dynamic";

function formatActivity(type: string): string {
  switch (type) {
    case "status_change":
      return "Status change";
    case "enrichment_run":
      return "Enrichment";
    case "email_sent":
      return "Email sent";
    case "call_logged":
      return "Call";
    case "sync_matched":
      return "Data sync";
    default:
      return "Note";
  }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Back to board
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{lead.company.name}</h1>
          <p className="text-sm text-slate-500">
            {lead.company.address_line ?? "No address on file"} · {lead.company.community ?? "Calgary"}
          </p>
          {lead.company.website && (
            <a
              href={lead.company.website}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {lead.company.website}
            </a>
          )}
        </div>
        <div className="w-40 shrink-0">
          <StatusSelect leadId={lead.id} status={lead.status} />
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">Score: {lead.score}/100</h2>
        {lead.scoreReasons.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {lead.scoreReasons.map((r, i) => (
              <li key={i}>
                +{r.points} — {r.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No score breakdown available.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-700">Contacts</h2>
        <div className="mt-2 space-y-2">
          {lead.contacts.length === 0 && (
            <p className="text-sm text-slate-400">No contacts found yet — enrichment may not have run.</p>
          )}
          {lead.contacts.map((c) => (
            <div key={c.id} className="rounded-md border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                {c.full_name}
                {c.is_primary && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">Primary</span>
                )}
              </p>
              <p className="text-xs text-slate-500">{c.title ?? "Unknown title"}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {c.email && (
                  <span>
                    {c.email}
                    {c.email_confidence != null ? ` (${c.email_confidence}% confidence)` : ""}
                  </span>
                )}
                {c.phone && <span>{c.phone}</span>}
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-700">Activity</h2>
        <div className="mt-2">
          <NoteForm leadId={lead.id} />
        </div>
        <ul className="mt-4 space-y-3">
          {lead.activities.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
          {lead.activities.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {formatActivity(a.type)}
              </span>
              <span className="text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              {a.body && <p className="mt-0.5 text-slate-700">{a.body}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
