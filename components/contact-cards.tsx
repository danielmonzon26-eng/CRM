import Link from "next/link";
import { Link2, Mail, Phone } from "lucide-react";
import { ComposeEmailButton } from "@/components/outlook/compose-email";
import { getInitials } from "@/lib/text";

export type ContactCard = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  emailConfidence?: number | null;
  phone: string | null;
  linkedinUrl?: string | null;
  isPrimary: boolean;
  leadId: string;
};

/** Everyone at a company, each with a button to email them from the CRM. */
export function ContactCards({
  contacts,
  canSend,
  blockedReason,
  linkNames = false,
  emptyText = "No contacts on file.",
}: {
  contacts: ContactCard[];
  canSend: boolean;
  blockedReason?: string;
  /** Link each name to the lead page (used on the company page). */
  linkNames?: boolean;
  emptyText?: string;
}) {
  if (contacts.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {contacts.map((c) => (
        <li key={c.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card">
          <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {getInitials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-900">
              {linkNames ? (
                <Link href={`/leads/${c.leadId}`} className="hover:text-brand-700 hover:underline">
                  {c.name}
                </Link>
              ) : (
                c.name
              )}
              {c.isPrimary && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">Primary</span>}
            </p>
            <p className="text-xs text-slate-500">{c.title ?? "No title on file"}</p>
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
              {c.email && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <Mail aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
                  <span className="truncate">{c.email}</span>
                  {c.emailConfidence != null && <span className="shrink-0 text-slate-400">({c.emailConfidence}%)</span>}
                </p>
              )}
              {c.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
                  <a href={`tel:${c.phone}`} className="hover:text-brand-700">{c.phone}</a>
                </p>
              )}
              {c.linkedinUrl && (
                <p className="flex items-center gap-1.5">
                  <Link2 aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
                  <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">LinkedIn</a>
                </p>
              )}
            </div>
          </div>
          {c.email && (
            <ComposeEmailButton
              canSend={canSend}
              blockedReason={blockedReason}
              size="sm"
              variant="ghost"
              label="Email"
              defaults={{ to: c.email, leadId: c.leadId }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
