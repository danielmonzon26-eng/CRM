import Link from "next/link";
import { Building2 } from "lucide-react";
import { getInitials } from "@/lib/text";
import type { DealListRow } from "@/lib/deals/queries";

export function DealCard({ deal }: { deal: DealListRow }) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-3 shadow-card transition-shadow hover:shadow-popover"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
          {getInitials(deal.companyName) || <Building2 className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{deal.name}</p>
          <p className="truncate text-xs text-slate-500">{deal.companyName}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-700">${deal.amount.toLocaleString()}</span>
        <span className="text-[11px] text-slate-400">{deal.probability}%</span>
      </div>

      {deal.nextStep && <p className="mt-1.5 truncate text-xs text-slate-500">Next: {deal.nextStep}</p>}
      <p className="mt-1 text-[11px] text-slate-400">Closes {new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
    </Link>
  );
}
