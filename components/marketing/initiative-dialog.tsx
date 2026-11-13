"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveInitiative, type InitiativeInput } from "@/app/actions/marketing";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";

export type InitiativeFormValues = Omit<InitiativeInput, "id">;

const BLANK: InitiativeFormValues = { name: "", objective: "", ownerId: null, eventId: null, startsOn: "", endsOn: "", budget: "" };

/** "New initiative" or "Edit", opening the same short form in a dialog. */
export function InitiativeButton({
  initiative,
  members,
  events,
  variant = "primary",
}: {
  initiative?: { id: string } & InitiativeFormValues;
  members: { id: string; name: string }[];
  events: { id: string; title: string }[];
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant)}>
        {initiative ? <Pencil className="h-4 w-4" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
        {initiative ? "Edit" : "New initiative"}
      </button>
      {open && <InitiativeDialog initiative={initiative} members={members} events={events} onClose={() => setOpen(false)} />}
    </>
  );
}

function InitiativeDialog({
  initiative,
  members,
  events,
  onClose,
}: {
  initiative?: { id: string } & InitiativeFormValues;
  members: { id: string; name: string }[];
  events: { id: string; title: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();
  const [values, setValues] = useState<InitiativeFormValues>(initiative ?? BLANK);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<InitiativeFormValues>) => setValues((v) => ({ ...v, ...patch }));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="initiative-title"
      className="animate-pop m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await saveInitiative({ id: initiative?.id ?? null, ...values }).catch(() => ({ error: "That didn't save. Please try again.", id: undefined }));
            if (result.error) return setError(result.error);
            toast(initiative ? "Initiative saved." : "Initiative created.");
            ref.current?.close();
            if (!initiative && result.id) router.push(`/marketing/initiatives/${result.id}`);
            else router.refresh();
          });
        }}
      >
        <div className="space-y-4 p-5">
          <h2 id="initiative-title" className="text-lg font-semibold text-slate-900">
            {initiative ? "Edit initiative" : "New initiative"}
          </h2>
          <label className={LABEL}>
            Name <span className="text-brand-600">*</span>
            <input required autoFocus maxLength={200} value={values.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Pitch Night 2027 promotion" className={FIELD} />
          </label>
          <label className={LABEL}>
            Objective
            <textarea rows={3} value={values.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="What should it achieve? e.g. 120 registrations" className={`${FIELD} resize-y`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Starts
              <input type="date" value={values.startsOn} onChange={(e) => set({ startsOn: e.target.value })} className={FIELD} />
            </label>
            <label className={LABEL}>
              Ends
              <input type="date" min={values.startsOn || undefined} value={values.endsOn} onChange={(e) => set({ endsOn: e.target.value })} className={FIELD} />
            </label>
            <label className={LABEL}>
              Owner
              <select value={values.ownerId ?? ""} onChange={(e) => set({ ownerId: e.target.value || null })} className={FIELD}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Budget ($)
              <input type="number" min={0} step="any" inputMode="decimal" value={values.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="Optional" className={FIELD} />
            </label>
          </div>
          <label className={LABEL}>
            Promotes an event
            <select value={values.eventId ?? ""} onChange={(e) => set({ eventId: e.target.value || null })} className={FIELD}>
              <option value="">No event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving..." : initiative ? "Save" : "Create initiative"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
