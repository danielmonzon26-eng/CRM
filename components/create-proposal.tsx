"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus, X } from "lucide-react";
import { createDeal, listProposalStaff } from "@/app/actions/deals";
import { PaymentToggle, StaffPicker, WorkTypePicker } from "@/components/proposal-fields";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { DEAL_STAGE_META, OPEN_DEAL_STAGES } from "@/lib/deals/stages";
import { MAX_PROPOSAL_FILE_BYTES, uploadProposalFile } from "@/lib/deals/upload";
import type { DealPayment, DealStage } from "@/lib/supabase/types";
import { DateInput } from "@/components/ui/date-input";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

function localDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
}

/** Starts a proposal for a lead or company. From a list it stays put; elsewhere it opens the proposal. */
export function CreateProposal({
  companyId,
  leadId,
  primaryContactId,
  defaultName,
  defaultWorkTypes = [],
  stayOnPage = false,
  compact = false,
}: {
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  defaultName: string;
  /** Usually the lead's chosen work, so the form starts there. */
  defaultWorkTypes?: string[];
  stayOnPage?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Create proposal for ${defaultName}`}
        className={compact ? "inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline" : buttonClass("primary", "sm")}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Create proposal
      </button>
      {open && (
        <CreateProposalDialog
          companyId={companyId}
          leadId={leadId}
          primaryContactId={primaryContactId}
          defaultName={defaultName}
          defaultWorkTypes={defaultWorkTypes}
          stayOnPage={stayOnPage}
          onClosed={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreateProposalDialog({
  companyId,
  leadId,
  primaryContactId,
  defaultName,
  defaultWorkTypes,
  stayOnPage,
  onClosed,
}: {
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  defaultName: string;
  defaultWorkTypes: string[];
  stayOnPage: boolean;
  onClosed: () => void;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const ref = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [staff, setStaff] = useState<{ id: string; name: string }[] | null>(null);
  const [staffFailed, setStaffFailed] = useState(false);
  const [name, setName] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<DealStage>("in_development");
  const [sentOn, setSentOn] = useState(localDate());
  const [decisionBy, setDecisionBy] = useState(localDate(30));
  const [workTypes, setWorkTypes] = useState<string[]>(defaultWorkTypes);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [payment, setPayment] = useState<DealPayment | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One key for this form: a second submit of the same form can't make a second proposal.
  const [requestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    ref.current?.showModal();
    listProposalStaff()
      .then(setStaff)
      .catch(() => setStaffFailed(true));
  }, []);

  function submit() {
    setError(null);
    if (file && file.size > MAX_PROPOSAL_FILE_BYTES) {
      setError("That file is over the 50 MB limit.");
      return;
    }
    startTransition(async () => {
      let dealId: string;
      try {
        dealId = await createDeal({
          name,
          companyId,
          leadId,
          primaryContactId,
          amount: Number(amount),
          expectedCloseDate: decisionBy,
          stage,
          workTypes,
          staffIds,
          payment,
          sentOn: stage === "sent" ? sentOn : null,
          requestKey,
        });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "That proposal didn't save. Please try again.");
        return;
      }
      // The proposal exists now, so a failed upload is reported but doesn't undo it.
      const uploadError = file ? await uploadProposalFile(dealId, file).catch(() => `${file.name} didn't upload.`) : null;
      ref.current?.close();
      if (uploadError) toast(`Proposal created, but ${uploadError} Try again from the proposal page.`, "error");
      else toast(`Proposal created for ${defaultName}`);
      if (stayOnPage) router.refresh();
      else router.push(`/deals/${dealId}`);
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="create-proposal-title"
      onClose={onClosed}
      onCancel={(e) => {
        if (isPending) e.preventDefault();
      }}
      className="animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto whitespace-normal rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="create-proposal-title" className="text-lg font-semibold text-slate-900">Create proposal</h2>
            <p className="mt-0.5 text-sm text-slate-600">For {defaultName}. You can change any of this later.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Proposal name
            <input required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </label>

          <WorkTypePicker value={workTypes} onChange={setWorkTypes} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Value ($)
              <input required type="number" min={0} step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Decision expected by
              <DateInput required value={decisionBy} onChange={(e) => setDecisionBy(e.target.value)} className={FIELD} />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Stage</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {OPEN_DEAL_STAGES.map((s) => (
                <label
                  key={s}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                    stage === s ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input type="radio" name="stage" className="sr-only" checked={stage === s} onChange={() => setStage(s)} />
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DEAL_STAGE_META[s].accent}`} />
                  {DEAL_STAGE_META[s].label}
                </label>
              ))}
            </div>
          </fieldset>
          {stage === "sent" && (
            <label className="block text-sm font-medium text-slate-700">
              Date sent
              <DateInput required value={sentOn} max={localDate()} onChange={(e) => setSentOn(e.target.value)} className={FIELD} />
            </label>
          )}

          <StaffPicker staff={staff} loadFailed={staffFailed} value={staffIds} onChange={setStaffIds} />
          <PaymentToggle value={payment} onChange={setPayment} />

          <div>
            <p className="text-sm font-medium text-slate-700">
              Copy of the proposal <span className="font-normal text-slate-500">(optional)</span>
            </p>
            {file ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-800">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900">
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300">
                <FileUp aria-hidden="true" className="h-4 w-4 text-slate-500" strokeWidth={2} />
                Choose a PDF, Word or other file (up to 50 MB)
                <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" disabled={isPending} onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={isPending} className={buttonClass("primary")}>
            {isPending ? "Creating..." : "Create proposal"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
