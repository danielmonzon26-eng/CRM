"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { DECLINED_BY, DECLINED_REASONS, type DeclinedBy } from "@/lib/deals/stages";
import type { DeclineDetails } from "@/app/actions/deals";

/**
 * Asked whenever a proposal moves to Declined: who declined it (them or us) and why, from
 * a fixed list so the reasons can be counted, plus an optional note.
 */
export function DeclineDialog({
  proposalName,
  onConfirm,
  onCancel,
}: {
  proposalName: string;
  onConfirm: (details: DeclineDetails) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [by, setBy] = useState<DeclinedBy>("them");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="decline-title"
      onClose={() => {
        if (!confirmed.current) onCancel();
      }}
      className="animate-pop m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason) return;
          confirmed.current = true;
          ref.current?.close();
          onConfirm({ by, reason, note: note.trim() || null });
        }}
      >
        <h2 id="decline-title" className="text-lg font-semibold text-slate-900">
          Mark {proposalName} as declined
        </h2>
        <p className="mt-1 text-sm text-slate-600">Recording why helps spot patterns, like pricing or timing.</p>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Who declined?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {DECLINED_BY.map(([key, label]) => (
              <label
                key={key}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  by === key ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="declinedBy"
                  className="sr-only"
                  checked={by === key}
                  onChange={() => {
                    setBy(key);
                    setReason("");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Main reason
          <select
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {DECLINED_REASONS[by].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Note <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="In their words, if they gave one"
            className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={!reason} className={buttonClass("primary")}>
            Mark as declined
          </button>
        </div>
      </form>
    </dialog>
  );
}
