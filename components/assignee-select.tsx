"use client";

import { useTransition } from "react";
import { assignLead } from "@/app/actions/leads";
import type { TeamMember } from "@/lib/leads/queries";

export function AssigneeSelect({
  leadId,
  assignedTo,
  members,
}: {
  leadId: string;
  assignedTo: string | null;
  members: TeamMember[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={assignedTo ?? ""}
      disabled={isPending}
      onChange={(e) => startTransition(() => assignLead(leadId, e.target.value || null))}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.fullName ?? m.email ?? m.id}
        </option>
      ))}
    </select>
  );
}
