"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { setDealPerson } from "@/app/actions/deals";
import { useFeedback } from "@/components/ui/feedback";
import { COMMITTEE_ROLES, type CommitteeRole } from "@/lib/deals/stages";
import { getInitials } from "@/lib/text";

type Person = { contactId: string; name: string; title: string | null; email: string | null; role: string | null };

/**
 * Who at the company is involved in this proposal and how. Naming the decision maker is
 * the one that matters most: a proposal without one is flagged on the board.
 */
export function BuyingCommittee({ dealId, leadId, people, open }: { dealId: string; leadId: string | null; people: Person[]; open: boolean }) {
  const hasDecisionMaker = people.some((p) => p.role === "decision_maker");
  return (
    <section aria-labelledby="committee-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="committee-title" className="text-sm font-semibold text-slate-700">
          Buying committee ({people.filter((p) => p.role).length})
        </h2>
        {leadId && (
          <Link href={`/leads/${leadId}#contacts`} className="text-xs font-medium text-brand-700 hover:underline">
            Add a contact
          </Link>
        )}
      </div>
      {open && !hasDecisionMaker && people.length > 0 && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          No decision maker named yet. Who signs off on this?
        </p>
      )}
      {people.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-600">
          {leadId ? "Nobody at this company is saved as a contact yet. Add contacts on the lead page, then give them roles here." : "This proposal isn't linked to a lead, so there are no contacts to choose from."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {people.map((person) => (
            <PersonRow key={person.contactId} dealId={dealId} person={person} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonRow({ dealId, person }: { dealId: string; person: Person }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [role, setRole] = useState(person.role ?? "");
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const previous = role;
    setRole(next);
    startTransition(async () => {
      const result = await setDealPerson(dealId, person.contactId, (next || null) as CommitteeRole | null).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) {
        setRole(previous);
        toast(result.error, "error");
      } else router.refresh();
    });
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${role ? "" : "bg-slate-50/60"}`}>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {getInitials(person.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${role ? "text-slate-900" : "text-slate-600"}`}>{person.name}</p>
        <p className="truncate text-xs text-slate-500">{person.title ?? person.email ?? "No title on file"}</p>
      </div>
      <label className="shrink-0">
        <span className="sr-only">Role for {person.name}</span>
        <select
          value={role}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          className={`rounded-lg border px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60 ${
            role === "decision_maker" ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-900" : role === "blocker" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-slate-300 bg-white text-slate-800"
          }`}
        >
          <option value="">Not involved</option>
          {COMMITTEE_ROLES.map(([key, label, hint]) => (
            <option key={key} value={key} title={hint}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}
