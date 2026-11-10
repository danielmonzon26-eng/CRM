"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { FEEDBACK_TOPICS, FOLLOW_UP_LABELS } from "@/lib/events/feedback";
import { submitFeedback } from "./actions";

const TEXTAREA =
  "mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** A 1 to 10 scale as one row of radio buttons, labelled at both ends. */
function Scale({
  name,
  legend,
  low,
  high,
  value,
  onChange,
  number,
}: {
  name: string;
  legend: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number) => void;
  number: number;
}) {
  return (
    <fieldset>
      <legend className="text-base font-medium text-slate-900">
        <span className="text-slate-500">{number}.</span> {legend} <span className="text-brand-700">*</span>
      </legend>
      <div className="mt-3 grid grid-cols-10 gap-1 sm:gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <label
            key={n}
            className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 sm:h-11 ${
              value === n ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
            }`}
          >
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" required />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
        <span>1 · {low}</span>
        <span>{high} · 10</span>
      </div>
    </fieldset>
  );
}

export function FeedbackForm({ token, firstName }: { token: string; firstName: string }) {
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [recommend, setRecommend] = useState<number | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [mostValuable, setMostValuable] = useState("");
  const [improve, setImprove] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center" role="status">
        <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-600" strokeWidth={1.75} />
        <p className="mt-3 text-lg font-semibold text-slate-900">Thank you{firstName ? `, ${firstName}` : ""}!</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          {followUp === "yes" ? "Someone from Catapult will be in touch soon." : "Your feedback helps us plan better events."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (satisfaction === null || recommend === null) {
          setError("Please answer the first two questions.");
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await submitFeedback({ token, satisfaction, recommend, topics, mostValuable, improve, followUp, website }).catch(() => ({
            status: "error" as const,
          }));
          if (result.status === "ok" || result.status === "already") setDone(true);
          else setError(result.status === "invalid" ? "Something in the form isn't valid. Please check your answers." : "That didn't send. Please try again.");
        });
      }}
      className="space-y-8 px-6 py-6"
    >
      <p className="text-sm text-slate-600">
        {firstName ? `Hi ${firstName}, thanks` : "Thanks"} for coming. Two minutes of feedback helps us make the next event better.
      </p>

      <Scale
        number={1}
        name="satisfaction"
        legend="How satisfied are you with the Catapult event you just attended?"
        low="Not satisfied"
        high="Very satisfied"
        value={satisfaction}
        onChange={setSatisfaction}
      />
      <Scale
        number={2}
        name="recommend"
        legend="How likely are you to recommend this event to someone else?"
        low="Would not recommend"
        high="Strongly recommend"
        value={recommend}
        onChange={setRecommend}
      />

      <fieldset>
        <legend className="text-base font-medium text-slate-900">
          <span className="text-slate-500">3.</span> Which topics would you like future events to cover?
        </legend>
        <p className="text-sm text-slate-500">Choose any that interest you.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FEEDBACK_TOPICS.map(([key, label]) => {
            const on = topics.includes(key);
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  on ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => setTopics(e.target.checked ? [...topics, key] : topics.filter((t) => t !== key))}
                />
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-400 bg-white"}`}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-base font-medium text-slate-900">
          <span className="text-slate-500">4.</span> What was the most valuable part of the event?
        </span>
        <textarea rows={3} value={mostValuable} onChange={(e) => setMostValuable(e.target.value)} maxLength={5000} className={TEXTAREA} />
      </label>

      <label className="block">
        <span className="text-base font-medium text-slate-900">
          <span className="text-slate-500">5.</span> What could we do better next time?
        </span>
        <textarea rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} maxLength={5000} className={TEXTAREA} />
      </label>

      <fieldset>
        <legend className="text-base font-medium text-slate-900">
          <span className="text-slate-500">6.</span> Would you like someone from Catapult to follow up about your business?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(FOLLOW_UP_LABELS).map(([key, label]) => (
            <label
              key={key}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                followUp === key ? "border-brand-600 bg-brand-600 font-medium text-white" : "border-slate-300 text-slate-700 hover:border-slate-400"
              }`}
            >
              <input type="radio" name="followUp" value={key} checked={followUp === key} onChange={() => setFollowUp(key)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
