"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { MAX_QUESTIONS, QUESTION_TYPES, type QuestionType, type RegistrationQuestion } from "@/lib/events/questions";

const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

const SUGGESTIONS: Omit<RegistrationQuestion, "id">[] = [
  { label: "Dietary restrictions or allergies", type: "short", options: [], required: false },
  { label: "How did you hear about this event?", type: "choice", options: ["LinkedIn", "Instagram", "Facebook", "Email", "A friend or colleague", "Other"], required: false },
  { label: "What do you hope to get out of it?", type: "long", options: [], required: false },
  { label: "I agree to be photographed at the event", type: "checkbox", options: [], required: false },
];

const newId = () => `q-${Math.random().toString(36).slice(2, 10)}`;

/** The organizer's list of extra questions for the registration form. */
export function RegistrationQuestionsEditor({ value, onChange }: { value: RegistrationQuestion[]; onChange: (next: RegistrationQuestion[]) => void }) {
  const update = (i: number, patch: Partial<RegistrationQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: number) => {
    const next = [...value];
    const [q] = next.splice(i, 1);
    next.splice(i + by, 0, q);
    onChange(next);
  };
  const add = (q: Omit<RegistrationQuestion, "id">) => onChange([...value, { ...q, id: newId() }]);
  const unused = SUGGESTIONS.filter((s) => !value.some((q) => q.label === s.label));
  const full = value.length >= MAX_QUESTIONS;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">Custom questions</p>
        <p className="text-xs text-slate-500">Asked after name and email. Answers show in the registrations list and its export.</p>
      </div>

      {value.length > 0 && (
        <ol className="space-y-2">
          {value.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_12rem_auto]">
                <span className="mt-2 text-xs font-medium tabular-nums text-slate-400">{i + 1}.</span>
                <input aria-label={`Question ${i + 1}`} value={q.label} placeholder="Your question" onChange={(e) => update(i, { label: e.target.value })} className={FIELD} />
                <div className="flex items-center gap-0.5 pt-1 sm:order-last">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md p-1.5 text-slate-500 hover:bg-white disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button type="button" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-white disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
                <select
                  aria-label={`Answer type for question ${i + 1}`}
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType;
                    update(i, { type, options: type === "choice" && q.options.length < 2 ? ["", ""] : q.options });
                  }}
                  className={`${FIELD} col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto`}
                >
                  {QUESTION_TYPES.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {q.type === "choice" && (
                <div className="ml-7 mt-2 space-y-1.5">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-slate-400" />
                      <input
                        aria-label={`Option ${oi + 1}`}
                        value={o}
                        placeholder={`Option ${oi + 1}`}
                        onChange={(e) => update(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                        className={`${FIELD} max-w-sm py-1.5`}
                      />
                      <button type="button" aria-label={`Remove option ${oi + 1}`} onClick={() => update(i, { options: q.options.filter((_, xi) => xi !== oi) })} className="rounded-md p-1 text-slate-400 hover:text-rose-700">
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => update(i, { options: [...q.options, ""] })} className="text-xs font-medium text-brand-700 hover:underline">
                    + Add option
                  </button>
                </div>
              )}

              <label className="ml-7 mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
                Required
              </label>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={full}
          onClick={() => add({ label: "", type: "short", options: [], required: false })}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add a question
        </button>
        {!full &&
          unused.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
            >
              + {s.label}
            </button>
          ))}
      </div>
    </div>
  );
}
