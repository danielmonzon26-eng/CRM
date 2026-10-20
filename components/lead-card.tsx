import Link from "next/link";
import { Building2 } from "lucide-react";
import { ScoreBadge } from "@/components/score-badge";
import { StatusSelect } from "@/components/status-select";
import { getInitials } from "@/lib/text";
import type { BoardLead } from "@/lib/leads/queries";

export function LeadCard({ lead }: { lead: BoardLead }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-3 shadow-card transition-shadow hover:shadow-popover">
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
            {lead.companyName === "Unknown company" ? <Building2 className="h-4 w-4" strokeWidth={2} /> : getInitials(lead.companyName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">{lead.companyName}</p>
            <p className="truncate text-xs text-slate-500">
              {lead.community ?? "Calgary"} · {lead.industry ?? "—"}
            </p>
          </div>
          <ScoreBadge score={lead.score} />
        </div>
      </Link>

      {lead.primaryContact && (
        <p className="mt-2.5 truncate text-xs text-slate-600">
          {lead.primaryContact.fullName}
          {lead.primaryContact.title ? ` — ${lead.primaryContact.title}` : ""}
        </p>
      )}

      <div className="mt-2.5">
        <span className="text-xs text-slate-400">
          {lead.contactCount} contact{lead.contactCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-2.5">
        <StatusSelect leadId={lead.id} status={lead.status} />
      </div>
    </div>
  );
}
