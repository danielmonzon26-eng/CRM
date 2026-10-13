import type { LeadStatus } from "@/lib/supabase/types";

const COLORS: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  researching: "bg-sky-100 text-sky-800",
  contacted: "bg-indigo-100 text-indigo-800",
  qualified: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-rose-100 text-rose-700",
  unqualified: "bg-slate-100 text-slate-500",
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${COLORS[status]}`}>
      {status}
    </span>
  );
}
