"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { registerForEvent, type RegisterResult } from "./actions";
import type { RegistrationAnswers, RegistrationQuestion } from "@/lib/events/questions";
import type { EventFormat } from "@/lib/supabase/types";

const INPUT =
  "mt-1.5 w-full rounded-[10px] border border-slate-300 bg-white px-3.5 py-2.5 text-base font-light text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";
const LABEL = "text-sm font-normal text-slate-700";

const ERROR_MESSAGES: Partial<Record<RegisterResult["status"], string>> = {
  already_registered: "This email is already registered for this event. Contact us if you need your details again.",
  sold_out: "Sorry, this event just sold out.",
  closed: "Registration for this event has closed.",
  not_open: "Registration for this event hasn't opened yet.",
  not_found: "This event is no longer available.",
  invalid: "Please check your name and email address.",
  error: "Something went wrong. Please try again.",
};

export function RegisterForm({
  slug,
  format,
  collectCompany,
  collectPhone,
  waitlist,
  paid,
  onlinePayment,
  priceLabel,
  questions = [],
}: {
  slug: string;
  format: EventFormat;
  collectCompany: boolean;
  collectPhone: boolean;
  waitlist: boolean;
  /** The ticket costs money (and this isn't a waitlist sign-up). */
  paid: boolean;
  /** Stripe is set up, so paying happens on Stripe Checkout right after this form. */
  onlinePayment: boolean;
  priceLabel: string;
  /** The event's own extra questions. */
  questions?: RegistrationQuestion[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("in_person");
  const [answers, setAnswers] = useState<RegistrationAnswers>({});
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result?.status === "checkout") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" strokeWidth={2} />
        Taking you to secure checkout…
      </div>
    );
  }

  if (result?.status === "waitlisted") {
    return (
      <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-800">
        <p className="flex items-center gap-2 text-base font-normal">
          <CheckCircle2 className="h-5 w-5 text-slate-600" strokeWidth={2} />
          You&apos;re on the waitlist
        </p>
        <p className="mt-2">Our team will contact you if a spot opens.</p>
        {result.confirmationMessage && <p className="mt-2 whitespace-pre-line">{result.confirmationMessage}</p>}
      </div>
    );
  }

  if (result?.status === "registered") {
    return (
      <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="flex items-center gap-2 text-base font-normal">
          <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          You&apos;re registered
        </p>
        <p className="mt-2 whitespace-pre-line">{result.confirmationMessage ?? "We have your spot saved. See you there."}</p>
        {result.paymentPending && <p className="mt-2">Our team will be in touch about payment.</p>}
        {result.onlineUrl && (
          <p className="mt-2">
            Join online:{" "}
            <a href={result.onlineUrl} target="_blank" rel="noreferrer" className="break-all font-normal underline">
              {result.onlineUrl}
            </a>
          </p>
        )}
        {result.ticketCode && (
          <p className="mt-3 text-xs">
            Your ticket number: <span className="font-mono text-sm">{result.ticketCode.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
      </div>
    );
  }

  const errorMessage = result ? result.message ?? ERROR_MESSAGES[result.status] : null;
  const submitLabel = waitlist ? "Join the waitlist" : paid && onlinePayment ? `Continue to payment · ${priceLabel}` : "Register";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          const next = await registerForEvent({
            slug,
            fullName,
            email,
            phone,
            company,
            website,
            attendanceMode: format === "hybrid" ? attendanceMode : null,
            answers,
          });
          setResult(next);
          if (next.status === "checkout" && next.checkoutUrl) window.location.assign(next.checkoutUrl);
        });
      }}
    >
      <div>
        <label className={LABEL} htmlFor="fullName">Full name</label>
        <input id="fullName" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
      </div>
      <div>
        <label className={LABEL} htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </div>
      {collectCompany && (
        <div>
          <label className={LABEL} htmlFor="company">Company <span className="text-slate-400">(optional)</span></label>
          <input id="company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT} />
        </div>
      )}
      {collectPhone && (
        <div>
          <label className={LABEL} htmlFor="phone">Phone <span className="text-slate-400">(optional)</span></label>
          <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
        </div>
      )}
      {format === "hybrid" && (
        <div>
          <label className={LABEL} htmlFor="attendanceMode">How will you attend?</label>
          <select id="attendanceMode" value={attendanceMode} onChange={(e) => setAttendanceMode(e.target.value)} className={INPUT}>
            <option value="in_person">In person</option>
            <option value="online">Online / livestream</option>
          </select>
        </div>
      )}
      {questions.map((q) => {
        const id = `q-${q.id}`;
        const optional = !q.required && <span className="text-slate-400"> (optional)</span>;
        if (q.type === "checkbox") {
          return (
            <label key={q.id} className="flex items-start gap-3 text-sm font-light text-slate-700">
              <input
                type="checkbox"
                required={q.required}
                checked={answers[q.id] === true}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              <span>
                {q.label}
                {optional}
              </span>
            </label>
          );
        }
        if (q.type === "choice") {
          return (
            <fieldset key={q.id}>
              <legend className={LABEL}>
                {q.label}
                {optional}
              </legend>
              <div className="mt-1.5 space-y-1.5">
                {q.options.map((o) => (
                  <label key={o} className="flex items-center gap-3 rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-base font-light text-slate-800 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
                    <input type="radio" name={id} required={q.required} value={o} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} className="h-4 w-4 text-brand-600 focus:ring-brand-400" />
                    {o}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }
        return (
          <div key={q.id}>
            <label className={LABEL} htmlFor={id}>
              {q.label}
              {optional}
            </label>
            {q.type === "long" ? (
              <textarea id={id} rows={3} required={q.required} value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={INPUT} />
            ) : (
              <input id={id} required={q.required} value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={INPUT} />
            )}
          </div>
        );
      })}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {errorMessage && <p className="rounded-[10px] bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand-600 px-4 py-3.5 text-base font-normal text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Sending…
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </>
        )}
      </button>
    </form>
  );
}
