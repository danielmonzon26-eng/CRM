import { Ban } from "lucide-react";
import { LeadClassification } from "@/components/lead-classification";
import { EngagementSelect, StatusSelect } from "@/components/status-select";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/leads/filters";
import type { LeadEngagement, LeadStatus } from "@/lib/supabase/types";

/**
 * Stage, status, client type and work for a lead, shared by the lead and company
 * pages. These apply to the whole company and all its contacts.
 */
export function LeadProperties({
  leadId,
  status,
  engagement,
  clientType,
  programs,
}: {
  leadId: string;
  status: LeadStatus;
  engagement: LeadEngagement;
  clientType: string | null;
  programs: string[];
}) {
  const stageIndex = ALL_STATUSES.indexOf(status);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead</h2>

      <ol aria-label={`Stage: ${STATUS_LABELS[status]}`} className="mt-3 flex gap-1">
        {ALL_STATUSES.map((s, i) => (
          <li
            key={s}
            title={STATUS_LABELS[s]}
            className={`h-1.5 flex-1 rounded-full ${i <= stageIndex ? (status === "client" ? "bg-emerald-500" : "bg-brand-500") : "bg-slate-200"}`}
          />
        ))}
      </ol>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="lead-stage" className="text-xs font-medium text-slate-500">
            Stage
          </label>
          <div className="mt-1">
            <StatusSelect id="lead-stage" leadId={leadId} status={status} />
          </div>
        </div>
        <div>
          <label htmlFor="lead-engagement" className="text-xs font-medium text-slate-500">
            Status
          </label>
          <div className="mt-1">
            <EngagementSelect id="lead-engagement" leadId={leadId} engagement={engagement} />
          </div>
          {engagement === "do_not_contact" && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Don&apos;t contact anyone at this company. Email from the CRM is blocked.
            </p>
          )}
        </div>
        <LeadClassification leadId={leadId} clientType={clientType} programs={programs} />
      </div>
    </div>
  );
}
