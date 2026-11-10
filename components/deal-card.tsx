import Link from "next/link";
import { CalendarDays, Paperclip } from "lucide-react";
import { ProgramChips } from "@/components/lead-badges";
import { PaymentBadge } from "@/components/proposal-fields";
import { formatMoney } from "@/lib/budgets/money";
import type { DealListRow } from "@/lib/deals/queries";
import { DEAL_STAGE_META } from "@/lib/deals/stages";

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** A proposal on a lead or company page. */
export function DealCard({ deal }: { deal: DealListRow }) {
  const meta = DEAL_STAGE_META[deal.stage];
  const when =
    deal.stage === "accepted" && deal.acceptedOn
      ? `Accepted ${formatDay(deal.acceptedOn)}`
      : deal.stage === "sent" && deal.sentOn
        ? `Sent ${formatDay(deal.sentOn)}`
        : deal.stage === "declined"
          ? "Declined"
          : `Decision by ${formatDay(deal.expectedCloseDate)}`;
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-3 shadow-card transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-popover"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{deal.name}</p>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.accent}`} />
          {meta.short}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="font-semibold tabular-nums text-slate-900">{formatMoney(deal.amount)}</span>
        <span className="flex items-center gap-1">
          <CalendarDays aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
          {when}
        </span>
        <PaymentBadge payment={deal.payment} />
        {deal.fileCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Paperclip aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
            {deal.fileCount}
          </span>
        )}
      </div>
      {deal.workTypes.length > 0 && (
        <div className="mt-2">
          <ProgramChips programs={deal.workTypes} />
        </div>
      )}
    </Link>
  );
}
