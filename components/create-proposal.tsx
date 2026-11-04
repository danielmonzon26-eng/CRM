"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createDeal } from "@/app/actions/deals";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { DEAL_STAGE_META, OPEN_DEAL_STAGES } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/supabase/types";

const FIELD = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** Starts a proposal for a lead or company. From a list it stays put; elsewhere it opens the proposal. */
export function CreateProposal({
  companyId,
  leadId,
  primaryContactId,
  defaultName,
  stayOnPage = false,
  compact = false,
}: {
  companyId: string;
  leadId: string | null;
  primaryContactId: string | null;
  defaultName: string;
  stayOnPage?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const dealId = await createDeal({
          name: String(data.get("name") ?? "").trim() || defaultName,
          companyId,
          leadId,
          primaryContactId,
          amount: Number(data.get("amount")),
          expectedCloseDate: String(data.get("expectedCloseDate") ?? ""),
          stage: data.get("stage") as DealStage,
        });
        setOpen(false);
        toast(`Proposal created for ${defaultName}`);
        if (stayOnPage) router.refresh();
        else router.push(`/deals/${dealId}`);
      } catch {
        toast("That proposal didn't save. Please try again.", "error");
      }
    });
  }

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
        <dialog
          ref={dialogRef}
          aria-labelledby="create-proposal-title"
          onClose={() => setOpen(false)}
          className="animate-pop m-auto w-[calc(100%-2rem)] max-w-md whitespace-normal rounded-xl bg-white p-5 text-left shadow-popover backdrop:bg-ink-950/50"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
          >
            <h2 id="create-proposal-title" className="text-lg font-semibold text-slate-900">Create proposal</h2>
            <p className="mt-1 text-sm text-slate-600">It will appear on the proposal board, where you can track it to close.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Proposal name
              <input name="name" required defaultValue={defaultName} className={FIELD} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Amount ($)
                <input name="amount" type="number" min={0} step="any" required inputMode="decimal" className={FIELD} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Expected close
                <input name="expectedCloseDate" type="date" required className={FIELD} />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Starting stage
              <select name="stage" defaultValue={OPEN_DEAL_STAGES[0]} className={FIELD}>
                {OPEN_DEAL_STAGES.map((stage) => <option key={stage} value={stage}>{DEAL_STAGE_META[stage].label}</option>)}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>Cancel</button>
              <button type="submit" disabled={isPending} className={buttonClass("primary")}>{isPending ? "Creating..." : "Create proposal"}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
