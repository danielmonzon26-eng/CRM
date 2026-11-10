"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { deleteDiscoveryCall, saveDiscoveryCall, type DiscoveryPatch } from "@/app/actions/discovery";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { DiscoveryCall } from "@/lib/discovery/queries";
import {
  APEX_THRESHOLD,
  BLOCK_OWNERS,
  BLOCK_STATUS_LABELS,
  BMC_BLOCKS,
  CONSULTANT_EXPERIENCE,
  ENTRY_POINTS,
  FLAGS,
  SECTIONS,
  completionScore,
  routeFor,
  suggestBlockStatus,
  type BlockStatus,
  type BmcBlock,
} from "@/lib/discovery/questionnaire";

const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const SAVE_DELAY_MS = 1200;

type State = Required<Omit<DiscoveryPatch, "blockStatus" | "answers">> & {
  answers: Record<string, string>;
  blockStatus: Partial<Record<BmcBlock, BlockStatus>>;
};

function initialState(call: DiscoveryCall): State {
  return {
    prospectName: call.prospectName ?? "",
    contactId: call.contactId,
    callDate: call.callDate,
    includeExpansion: call.includeExpansion,
    answers: call.answers,
    blockStatus: call.blockStatus as Partial<Record<BmcBlock, BlockStatus>>,
    consultantExperience: call.consultantExperience,
    consultantNotes: call.consultantNotes ?? "",
    pricingDiscussed: call.pricingDiscussed,
    decisionMakerPresent: call.decisionMakerPresent,
    flags: call.flags,
    recommendedEntry: call.recommendedEntry,
    entryReason: call.entryReason ?? "",
  };
}

const STATUS_STYLE: Record<BlockStatus, string> = {
  complete: "bg-emerald-600 text-white",
  partial: "bg-amber-500 text-white",
  unknown: "bg-slate-500 text-white",
};
const STATUS_DOT: Record<BlockStatus, string> = { complete: "bg-emerald-500", partial: "bg-amber-400", unknown: "bg-slate-300" };

/** The discovery questionnaire. Every change saves on its own shortly after typing stops. */
export function DiscoveryForm({
  call,
  companyName,
  contacts,
}: {
  call: DiscoveryCall;
  companyName: string;
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [state, setState] = useState(() => initialState(call));
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [errorText, setErrorText] = useState<string | null>(null);
  const pending = useRef<DiscoveryPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setSaveState("saving");
    try {
      const result = await saveDiscoveryCall(call.id, patch);
      if (result.error) {
        pending.current = { ...patch, ...pending.current };
        setErrorText(result.error);
        setSaveState("error");
        return;
      }
      setErrorText(null);
      setSaveState(Object.keys(pending.current).length ? "pending" : "saved");
    } catch {
      pending.current = { ...patch, ...pending.current };
      setErrorText("Couldn't reach the server. Your notes are kept here and will save when you try again.");
      setSaveState("error");
    }
  }, [call.id]);

  function change(patch: Partial<State>) {
    setState((current) => {
      const next = { ...current, ...patch };
      // Block marks are sent whole, so the server can always work out the score.
      const toSend: DiscoveryPatch = { ...patch, ...(patch.blockStatus ? { blockStatus: next.blockStatus as Record<string, BlockStatus> } : {}) };
      if (patch.answers) toSend.answers = next.answers;
      pending.current = { ...pending.current, ...toSend };
      return next;
    });
    setSaveState("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  // Save before leaving, and warn if something couldn't be saved.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      clearTimeout(timer.current);
    };
  }, [flush]);

  const effectiveStatus = useMemo(() => {
    const result = {} as Record<BmcBlock, BlockStatus>;
    for (const block of BMC_BLOCKS) result[block] = state.blockStatus[block] ?? "unknown";
    return result;
  }, [state.blockStatus]);
  const score = completionScore(effectiveStatus);
  const route = routeFor(score);
  const partialOrUnknown = BMC_BLOCKS.filter((b) => effectiveStatus[b] !== "complete");
  const sections = SECTIONS.filter((s) => s.id !== "expansion" || state.includeExpansion);
  let number = 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
          <p className="text-sm text-slate-600">
            Business Model Canvas framework. Ask the questions as written so every call is comparable. Tone is diagnosis, not interrogation.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Prospect
              {contacts.length > 0 ? (
                <select
                  value={state.contactId ?? ""}
                  onChange={(e) => {
                    const contact = contacts.find((c) => c.id === e.target.value);
                    change({ contactId: e.target.value || null, prospectName: contact?.name ?? state.prospectName });
                  }}
                  className={`${FIELD} mt-1`}
                >
                  <option value="">Someone else</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {(!state.contactId || contacts.length === 0) && (
                <input
                  value={state.prospectName ?? ""}
                  onChange={(e) => change({ prospectName: e.target.value })}
                  placeholder="Name"
                  className={`${FIELD} mt-1`}
                />
              )}
            </label>
            <div className="text-sm font-medium text-slate-700">
              Company
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-800">{companyName}</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Date
              <input type="date" required value={state.callDate} onChange={(e) => e.target.value && change({ callDate: e.target.value })} className={`${FIELD} mt-1`} />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={state.includeExpansion}
              onChange={(e) => change({ includeExpansion: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              <span className="font-medium">Add the Expansion Module</span>
              <span className="block text-slate-500">For prospects who are expanding, exporting or cross-border. It's asked after Channels.</span>
            </span>
          </label>
        </section>

        {sections.map((section) => {
          const block = section.bmc ? (section.id as BmcBlock) : null;
          const suggestion = block ? suggestBlockStatus(block, state.answers) : null;
          const marked = block ? state.blockStatus[block] : undefined;
          return (
            <section key={section.id} id={`section-${section.id}`} aria-labelledby={`title-${section.id}`} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 id={`title-${section.id}`} className="text-sm font-semibold uppercase tracking-wide text-ink-900">
                  {section.title}
                </h2>
                {block && <span className="text-xs text-slate-500">Owner: {BLOCK_OWNERS[block]}</span>}
                {!block && section.id === "expansion" && <span className="text-xs text-slate-500">Not scored</span>}
              </header>
              <ol className="divide-y divide-slate-100">
                {section.questions.map((q) => {
                  number += 1;
                  return (
                    <li key={q.id} className="px-4 py-4 sm:px-5">
                      <label htmlFor={`answer-${q.id}`} className="block">
                        <span className="flex gap-2 text-sm font-semibold text-slate-900">
                          <span className="w-6 shrink-0 tabular-nums text-slate-500">{number}.</span>
                          {q.text}
                        </span>
                        <span className="mt-1 flex gap-2 pl-8 text-sm text-sky-800">
                          → Probe: {q.ip && <span className="rounded bg-violet-50 px-1 text-xs font-semibold text-violet-800">IP</span>} {q.probe}
                        </span>
                      </label>
                      <div className="mt-2 pl-8">
                        <textarea
                          id={`answer-${q.id}`}
                          rows={2}
                          value={state.answers[q.id] ?? ""}
                          onChange={(e) => change({ answers: { ...state.answers, [q.id]: e.target.value } })}
                          placeholder="Notes"
                          className={`${FIELD} field-sizing-content min-h-16 resize-y`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
              {block && (
                <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                  <div className="text-sm">
                    <span className="font-medium text-slate-800">How well did we cover {section.title}?</span>
                    {!marked && suggestion && (
                      <span className="block text-xs text-slate-500">Based on the notes: {BLOCK_STATUS_LABELS[suggestion]}. Not marked yet, so it counts as Unknown.</span>
                    )}
                  </div>
                  <div role="radiogroup" aria-label={`${section.title} status`} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                    {(["complete", "partial", "unknown"] as BlockStatus[]).map((status) => {
                      const on = marked === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => change({ blockStatus: { ...state.blockStatus, [block]: status } })}
                          className={`rounded-md px-3 py-1 text-sm transition-colors ${on ? `${STATUS_STYLE[status]} font-medium` : `text-slate-700 hover:bg-slate-100 ${suggestion === status && !marked ? "ring-1 ring-inset ring-brand-300" : ""}`}`}
                        >
                          {BLOCK_STATUS_LABELS[status]}
                        </button>
                      );
                    })}
                  </div>
                </footer>
              )}
            </section>
          );
        })}

        <section id="section-read" aria-labelledby="title-read" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-card">
          <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 id="title-read" className="text-sm font-semibold uppercase tracking-wide text-ink-900">
              The read
            </h2>
            <p className="text-xs text-slate-500">Internal only. Never sent to the prospect. Be straight: a soft read costs a week of chasing.</p>
          </header>
          <div className="space-y-5 px-4 py-4 sm:px-5">
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Past consultant experience</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CONSULTANT_EXPERIENCE.map(([key, label]) => (
                  <Chip key={key} on={state.consultantExperience === key} onClick={() => change({ consultantExperience: state.consultantExperience === key ? null : key })}>
                    {label}
                  </Chip>
                ))}
              </div>
              <textarea
                rows={2}
                value={state.consultantNotes ?? ""}
                onChange={(e) => change({ consultantNotes: e.target.value })}
                placeholder="In their words"
                className={`${FIELD} mt-2 resize-y`}
              />
              {state.consultantExperience === "bad" && (
                <p className="mt-1.5 text-xs text-amber-800">Bad experience: steer toward self-directed options (Advisory Pass, course modules), not done-for-you work.</p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <YesNo label="Pricing discussed" value={state.pricingDiscussed} onChange={(pricingDiscussed) => change({ pricingDiscussed })} />
              <YesNo label="Decision maker on the call" value={state.decisionMakerPresent} onChange={(decisionMakerPresent) => change({ decisionMakerPresent })} />
            </div>
            {state.pricingDiscussed === false && <p className="-mt-2 text-xs text-amber-800">No pricing yet: the next step must get to a pricing conversation.</p>}
            {state.decisionMakerPresent === false && <p className="-mt-2 text-xs text-amber-800">Decision maker absent: nothing is quoted until they're in a conversation, whatever the score.</p>}

            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Flags</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FLAGS.map(([key, label]) => {
                  const on = state.flags.includes(key);
                  return (
                    <Chip key={key} on={on} tone="rose" onClick={() => change({ flags: on ? state.flags.filter((f) => f !== key) : [...state.flags, key] })}>
                      {label}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <label className="block text-sm font-medium text-slate-800">
                Recommended entry point
                <select value={state.recommendedEntry ?? ""} onChange={(e) => change({ recommendedEntry: e.target.value || null })} className={`${FIELD} mt-1`}>
                  <option value="">Not decided</option>
                  {ENTRY_POINTS.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Why, tied to something they said
                <input value={state.entryReason ?? ""} onChange={(e) => change({ entryReason: e.target.value })} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({ title: "Delete this discovery call?", body: "Its notes and score are removed for everyone. This can't be undone.", confirmLabel: "Delete", danger: true });
              if (!ok) return;
              clearTimeout(timer.current);
              pending.current = {};
              const result = await deleteDiscoveryCall(call.id).catch(() => ({ error: "The call wasn't deleted.", leadId: undefined }));
              if (result.error) toast(result.error, "error");
              else router.push(`/leads/${call.leadId}`);
            }}
            className={`${buttonClass("ghost", "sm")} text-rose-700 hover:bg-rose-50`}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Delete this call
          </button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</h2>
            <SaveStatus state={saveState} onRetry={() => void flush()} />
          </div>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-slate-900">{Math.round(score)}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(score)} aria-valuemin={0} aria-valuemax={100} aria-label="BMC completion">
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${score}%` }} />
          </div>
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${route.tone}`}>
            <span className="font-semibold">{route.label}.</span> {route.detail}
          </p>
          {score >= APEX_THRESHOLD && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-violet-800">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              Eligible for an invite to the next Apex event
            </p>
          )}
          {state.decisionMakerPresent === false && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              Don&apos;t quote until the decision maker is in a conversation.
            </p>
          )}
          {errorText && (
            <p role="alert" className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
              {errorText}
            </p>
          )}
        </div>

        <nav aria-label="Canvas blocks" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canvas</h2>
          <ul className="mt-2 space-y-1">
            {BMC_BLOCKS.map((block) => (
              <li key={block}>
                <a href={`#section-${block}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                  <span className="flex items-center gap-2 text-slate-800">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT[effectiveStatus[block]]}`} />
                    {SECTIONS.find((s) => s.id === block)!.title}
                  </span>
                  <span className="text-xs text-slate-500">{state.blockStatus[block] ? BLOCK_STATUS_LABELS[effectiveStatus[block]] : "Not marked"}</span>
                </a>
              </li>
            ))}
          </ul>
          {partialOrUnknown.length > 0 && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
              {partialOrUnknown.length} block{partialOrUnknown.length === 1 ? "" : "s"} to follow up on the next call or email.
            </p>
          )}
        </nav>
      </aside>
    </div>
  );
}

function Chip({ on, onClick, children, tone = "brand" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "brand" | "rose" }) {
  const onStyle = tone === "rose" ? "border-rose-600 bg-rose-50 text-rose-800" : "border-brand-600 bg-brand-50 text-brand-800";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${on ? `${onStyle} font-medium` : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
    >
      {on && <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {children}
    </button>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{label}</legend>
      <div className="mt-1.5 flex gap-1.5">
        <Chip on={value === true} onClick={() => onChange(value === true ? null : true)}>
          Yes
        </Chip>
        <Chip on={value === false} tone="rose" onClick={() => onChange(value === false ? null : false)}>
          No
        </Chip>
      </div>
    </fieldset>
  );
}

function SaveStatus({ state, onRetry }: { state: "saved" | "pending" | "saving" | "error"; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className="text-xs font-medium text-rose-700 hover:underline">
        Not saved. Retry
      </button>
    );
  }
  return (
    <span role="status" className="flex items-center gap-1 text-xs text-slate-500">
      {state === "saving" ? (
        <>
          <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" strokeWidth={2} /> Saving...
        </>
      ) : state === "pending" ? (
        "Editing..."
      ) : (
        <>
          <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} /> Saved
        </>
      )}
    </span>
  );
}
