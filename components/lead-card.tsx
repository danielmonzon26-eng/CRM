import Link from "next/link";
import { ScoreBadge } from "@/components/score-badge";
import { StatusSelect } from "@/components/status-select";
import type { BoardLead } from "@/lib/leads/queries";

export function LeadCard({ lead }: { lead: BoardLead }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link href={`/leads/${lead.id}`} className="block">
        <p className="truncate font-medium text-slate-900">{lead.companyName}</p>
        <p className="truncate text-xs text-slate-500">
          {lead.community ?? "Calgary"} · {lead.industry ?? "—"}
        </p>
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <ScoreBadge score={lead.score} />
        <span className="text-xs text-slate-500">
          {lead.contactCount} contact{lead.contactCount === 1 ? "" : "s"}
        </span>
      </div>

      {lead.primaryContact && (
        <p className="mt-1 truncate text-xs text-slate-600">
          {lead.primaryContact.fullName}
          {lead.primaryContact.title ? ` — ${lead.primaryContact.title}` : ""}
        </p>
      )}

      <div className="mt-2">
        <StatusSelect leadId={lead.id} status={lead.status} />
      </div>
    </div>
  );
}
