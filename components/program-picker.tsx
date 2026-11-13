"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addEventProgram, removeEventProgram, type Program } from "@/app/actions/programs";
import { buttonClass } from "@/components/ui/button";

const MANAGE = "__manage__";

/** The Program dropdown, with a way to add programs to the list and take them off it. */
export function ProgramPicker({
  id,
  value,
  onChange,
  programs: initial,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  programs: Program[];
  className: string;
}) {
  const [programs, setPrograms] = useState(initial);
  const [managing, setManaging] = useState(false);
  const known = programs.some((p) => p.name === value);

  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === MANAGE) setManaging(true);
          else onChange(e.target.value);
        }}
        className={className}
      >
        <option value="">No program</option>
        {programs.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
        {/* A program taken off the list stays on events that already use it. */}
        {value && !known && <option value={value}>{value}</option>}
        <option disabled>──────────</option>
        <option value={MANAGE}>Add or remove programs…</option>
      </select>
      {managing && (
        <ManagePrograms
          programs={programs}
          onChange={setPrograms}
          onPick={(name) => onChange(name)}
          onClose={() => setManaging(false)}
        />
      )}
    </>
  );
}

function ManagePrograms({
  programs,
  onChange,
  onPick,
  onClose,
}: {
  programs: Program[];
  onChange: (next: Program[]) => void;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="programs-title" className="animate-pop m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50">
      <div className="space-y-3 p-5">
        <h2 id="programs-title" className="text-lg font-semibold text-slate-900">
          Programs
        </h2>
        <p className="text-sm text-slate-500">Removing one takes it off the list. Events already using it keep it.</p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {programs.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500">No programs yet.</li>}
          {programs.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800">
              {p.name}
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await removeEventProgram(p.id).catch(() => ({ error: "That wasn't removed. Please try again." }));
                    if (result.error) setError(result.error);
                    else onChange(programs.filter((x) => x.id !== p.id));
                  })
                }
                className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await addEventProgram(name).catch(() => ({ error: "That didn't save. Please try again.", program: undefined }));
              if (result.error || !result.program) return setError(result.error ?? "That didn't save.");
              onChange([...programs, result.program]);
              onPick(result.program.name);
              setName("");
            });
          }}
          className="flex gap-2"
        >
          <input
            aria-label="New program"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Founder Series"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button type="submit" disabled={pending || !name.trim()} className={buttonClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
          Done
        </button>
      </div>
    </dialog>
  );
}
