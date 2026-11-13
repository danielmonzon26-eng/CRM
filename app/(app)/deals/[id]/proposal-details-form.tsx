"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDealStaff, updateDealDetails, type DealDetailsPatch } from "@/app/actions/deals";
import { PaymentToggle, StaffPicker, WorkTypePicker } from "@/components/proposal-fields";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { DealDetail } from "@/lib/deals/queries";
import type { DealPayment } from "@/lib/supabase/types";
import { DateInput } from "@/components/ui/date-input";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";

type Values = {
  name: string;
  amount: string;
  expectedCloseDate: string;
  workTypes: string[];
  staffIds: string[];
  payment: DealPayment | null;
  sentOn: string;
  acceptedOn: string;
  nextStep: string;
  nextStepDueDate: string;
  notes: string;
  declinedReason: string;
};

function valuesOf(deal: DealDetail): Values {
  return {
    name: deal.name,
    amount: String(deal.amount),
    expectedCloseDate: deal.expectedCloseDate,
    workTypes: deal.workTypes,
    staffIds: deal.staffIds,
    payment: deal.payment,
    sentOn: deal.sentOn ?? "",
    acceptedOn: deal.acceptedOn ?? "",
    nextStep: deal.nextStep ?? "",
    nextStepDueDate: deal.nextStepDueDate ?? "",
    notes: deal.notes ?? "",
    declinedReason: deal.lostReason ?? "",
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Every editable detail of a proposal, saved together with one button. */
export function ProposalDetailsForm({ deal, staff }: { deal: DealDetail; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const initial = useMemo(() => valuesOf(deal), [deal]);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

  const patch: DealDetailsPatch = {};
  if (values.name !== initial.name) patch.name = values.name;
  if (values.amount !== initial.amount) patch.amount = Number(values.amount);
  if (values.expectedCloseDate !== initial.expectedCloseDate) patch.expectedCloseDate = values.expectedCloseDate;
  if (!sameSet(values.workTypes, initial.workTypes)) patch.workTypes = values.workTypes;
  if (values.payment !== initial.payment) patch.payment = values.payment;
  if (values.sentOn !== initial.sentOn) patch.sentOn = values.sentOn || null;
  if (values.acceptedOn !== initial.acceptedOn) patch.acceptedOn = values.acceptedOn || null;
  if (values.nextStep !== initial.nextStep) patch.nextStep = values.nextStep;
  if (values.nextStepDueDate !== initial.nextStepDueDate) patch.nextStepDueDate = values.nextStepDueDate || null;
  if (values.notes !== initial.notes) patch.notes = values.notes;
  if (values.declinedReason !== initial.declinedReason) patch.declinedReason = values.declinedReason;
  const staffChanged = !sameSet(values.staffIds, initial.staffIds);
  const dirty = Object.keys(patch).length > 0 || staffChanged;

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        const result = Object.keys(patch).length ? await updateDealDetails(deal.id, patch) : {};
        if (result.error) {
          setError(result.error);
          return;
        }
        if (staffChanged) {
          const staffResult = await setDealStaff(deal.id, values.staffIds);
          if (staffResult.error) {
            setError(staffResult.error);
            return;
          }
        }
        toast("Proposal saved.");
        router.refresh();
      } catch {
        setError("That didn't save. Please try again.");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="rounded-xl border border-slate-200 bg-white shadow-card"
    >
      <div className="space-y-5 p-4 sm:p-5">
        <label className={LABEL}>
          Proposal name
          <input required value={values.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
        </label>

        <WorkTypePicker value={values.workTypes} onChange={(workTypes) => set({ workTypes })} />
        <StaffPicker staff={staff} value={values.staffIds} onChange={(staffIds) => set({ staffIds })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Value ($)
            <input required type="number" min={0} step="any" inputMode="decimal" value={values.amount} onChange={(e) => set({ amount: e.target.value })} className={FIELD} />
          </label>
          <PaymentToggle value={values.payment} onChange={(payment) => set({ payment })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className={LABEL}>
            Date sent
            <DateInput value={values.sentOn} onChange={(e) => set({ sentOn: e.target.value })} className={FIELD} />
          </label>
          <label className={LABEL}>
            Date accepted
            <DateInput
              value={values.acceptedOn}
              disabled={deal.stage !== "accepted"}
              title={deal.stage !== "accepted" ? "Set when the proposal is marked Accepted" : undefined}
              onChange={(e) => set({ acceptedOn: e.target.value })}
              className={`${FIELD} disabled:bg-slate-50 disabled:text-slate-500`}
            />
          </label>
          <label className={LABEL}>
            Decision expected by
            <DateInput required value={values.expectedCloseDate} onChange={(e) => set({ expectedCloseDate: e.target.value })} className={FIELD} />
          </label>
        </div>

        {deal.stage === "declined" && (
          <label className={LABEL}>
            Note on why it was declined
            <input value={values.declinedReason} onChange={(e) => set({ declinedReason: e.target.value })} placeholder="e.g. Budget moved to next year" className={FIELD} />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className={LABEL}>
            Next step
            <input value={values.nextStep} onChange={(e) => set({ nextStep: e.target.value })} placeholder="e.g. Walk through options with the owner" className={FIELD} />
          </label>
          <label className={LABEL}>
            Next step due
            <DateInput value={values.nextStepDueDate} onChange={(e) => set({ nextStepDueDate: e.target.value })} className={FIELD} />
          </label>
        </div>

        <label className={LABEL}>
          Notes
          <textarea rows={5} value={values.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Scope, pricing discussed, anything the team should know" className={`${FIELD} resize-y`} />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <span role="status" className="mr-auto text-xs text-slate-500">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <button type="button" disabled={!dirty || saving} onClick={() => setValues(initial)} className={buttonClass("ghost")}>
          Discard
        </button>
        <button type="submit" disabled={!dirty || saving} className={buttonClass("primary")}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
