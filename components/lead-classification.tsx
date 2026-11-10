"use client";

import { useState, useTransition } from "react";
import { updateLeadClassification } from "@/app/actions/leads";
import { useFeedback } from "@/components/ui/feedback";
import { CLIENT_TYPES, LEAD_PROGRAMS } from "@/lib/leads/classification";

/** Client type and programs on a lead. Each change saves right away. */
export function LeadClassification({
  leadId,
  clientType,
  programs,
}: {
  leadId: string;
  clientType: string | null;
  programs: string[];
}) {
  const { toast } = useFeedback();
  const [type, setType] = useState(clientType ?? "");
  const [selected, setSelected] = useState(programs);
  const [isPending, startTransition] = useTransition();

  function save(next: { clientType?: string | null; programs?: string[] }, undo: () => void) {
    startTransition(async () => {
      try {
        const result = await updateLeadClassification(leadId, next);
        if (result.error) {
          undo();
          toast(result.error, "error");
        }
      } catch {
        undo();
        toast("That change didn't save. Please try again.", "error");
      }
    });
  }

  return (
    <>
      <div>
        <label htmlFor="clientType" className="text-xs font-medium text-slate-500">Client type</label>
        <select
          id="clientType"
          value={type}
          disabled={isPending}
          onChange={(e) => {
            const previous = type;
            setType(e.target.value);
            save({ clientType: e.target.value || null }, () => setType(previous));
          }}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
        >
          <option value="">Not set</option>
          {CLIENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <fieldset disabled={isPending}>
        <legend className="text-xs font-medium text-slate-500">Work we do</legend>
        <div className="mt-1.5 space-y-1.5">
          {LEAD_PROGRAMS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={(e) => {
                  const previous = selected;
                  const next = e.target.checked ? [...selected, value] : selected.filter((p) => p !== value);
                  setSelected(next);
                  save({ programs: next }, () => setSelected(previous));
                }}
                className="h-4 w-4 accent-brand-600"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
