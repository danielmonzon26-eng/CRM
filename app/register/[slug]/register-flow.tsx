"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarPlus, CheckCircle2, Loader2, Lock, X } from "lucide-react";
import { registerForEvent, type RegisterResult } from "./actions";
import type { RegistrationAnswers, RegistrationQuestion } from "@/lib/events/questions";
import type { EventFormat } from "@/lib/supabase/types";

const INPUT =
  "mt-1.5 w-full rounded-[10px] border border-slate-300 bg-white px-3.5 py-2.5 text-base font-light text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";
const LABEL = "text-sm font-normal text-slate-700";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand-600 px-5 py-3 text-base font-normal text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60";

const ERROR_MESSAGES: Partial<Record<RegisterResult["status"], string>> = {
  already_registered: "This email is already registered for this event. Contact us if you need your details again.",
  sold_out: "Sorry, this event just sold out.",
  closed: "Registration for this event has closed.",
  not_open: "Registration for this event hasn't opened yet.",
  not_found: "This event is no longer available.",
  invalid: "Please check your name and email address.",
  error: "Something went wrong. Please try again.",
};

export type FlowEvent = {
  slug: string;
  title: string;
  whenLabel: string;
  whereLabel: string;
  format: EventFormat;
  collectCompany: boolean;
  collectPhone: boolean;
  waitlist: boolean;
  /** The ticket costs money (and this isn't a waitlist sign-up). */
  paid: boolean;
  /** Stripe is set up, so paying happens on Stripe Checkout right after this flow. */
  onlinePayment: boolean;
  testMode: boolean;
  priceLabel: string;
  currency: string;
  questions: RegistrationQuestion[];
  /** Google Calendar link for the confirmation. */
  calendarUrl: string;
};

type Step = "details" | "questions" | "review";

/**
 * The registration call to action and the popup it opens: your details, the event's own
 * questions (when it has any), then a review before registering or paying. On phones a bar
 * with the price and the button stays at the bottom of the screen.
 */
export function RegisterFlow({ event, startOpen = false }: { event: FlowEvent; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const label = event.waitlist ? "Join the waitlist" : event.paid ? "Get tickets" : "Register";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${PRIMARY} w-full py-3.5`}>
        {label}
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-normal text-slate-900">{event.title}</p>
            <p className="text-sm text-slate-500">
              {event.priceLabel}
              {event.paid && ` ${event.currency}`}
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className={PRIMARY}>
            {label}
          </button>
        </div>
      </div>

      {open && <FlowDialog event={event} onClose={() => setOpen(false)} />}
    </>
  );
}

function FlowDialog({ event, onClose }: { event: FlowEvent; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("in_person");
  const [answers, setAnswers] = useState<RegistrationAnswers>({});
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const steps: Step[] = event.questions.length ? ["details", "questions", "review"] : ["details", "review"];
  const index = steps.indexOf(step);
  const stepTitle = { details: "Your details", questions: "A few questions", review: "Review and confirm" }[step];
  const done = result?.status === "registered" || result?.status === "waitlisted" || result?.status === "checkout";
  const submitLabel = event.waitlist ? "Join the waitlist" : event.paid && event.onlinePayment ? `Continue to payment · ${event.priceLabel}` : "Confirm registration";
  const errorMessage = result && !done ? (result.message ?? ERROR_MESSAGES[result.status]) : null;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step !== "review") {
      setStep(steps[index + 1]);
      return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await registerForEvent({
        slug: event.slug,
        fullName,
        email,
        phone,
        company,
        website,
        attendanceMode: event.format === "hybrid" ? attendanceMode : null,
        answers,
      }).catch((): RegisterResult => ({ status: "error" }));
      setResult(res);
      if (res.status === "checkout" && res.checkoutUrl) window.location.assign(res.checkoutUrl);
    });
  }

  const answerText = (q: RegistrationQuestion) => {
    const a = answers[q.id];
    if (q.type === "checkbox") return a === true ? "Yes" : "No";
    return typeof a === "string" && a.trim() ? a : "—";
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="register-title"
      className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-white p-0 text-left font-light text-slate-900 backdrop:bg-slate-950/50 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-3rem)] sm:max-w-lg sm:rounded-3xl sm:shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-500">{event.title}</p>
            <h2 id="register-title" className="mt-0.5 text-xl font-normal text-slate-950">
              {done ? (result?.status === "waitlisted" ? "You're on the waitlist" : result?.status === "checkout" ? "Almost there" : "You're registered") : stepTitle}
            </h2>
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="-mr-2 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        {!done && (
          <ol aria-label="Steps" className="flex gap-1.5 px-6 pt-4 sm:px-8">
            {steps.map((s, i) => (
              <li key={s} aria-current={s === step ? "step" : undefined} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-brand-500" : "bg-slate-200"}`}>
                <span className="sr-only">
                  Step {i + 1} of {steps.length}
                </span>
              </li>
            ))}
          </ol>
        )}

        {done ? (
          <Done event={event} result={result!} onClose={() => ref.current?.close()} />
        ) : (
          <form onSubmit={next} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6 sm:px-8">
              {step === "details" && (
                <>
                  <div>
                    <label className={LABEL} htmlFor="fullName">Full name</label>
                    <input id="fullName" required autoFocus autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="email">Email</label>
                    <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
                    <p className="mt-1.5 text-xs text-slate-500">Your confirmation goes here.</p>
                  </div>
                  {event.collectCompany && (
                    <div>
                      <label className={LABEL} htmlFor="company">Company <span className="text-slate-400">(optional)</span></label>
                      <input id="company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT} />
                    </div>
                  )}
                  {event.collectPhone && (
                    <div>
                      <label className={LABEL} htmlFor="phone">Phone <span className="text-slate-400">(optional)</span></label>
                      <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
                    </div>
                  )}
                  {event.format === "hybrid" && (
                    <fieldset>
                      <legend className={LABEL}>How will you attend?</legend>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {[
                          ["in_person", "In person"],
                          ["online", "Online"],
                        ].map(([value, text]) => (
                          <label key={value} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-base text-slate-800 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
                            <input type="radio" name="attendanceMode" value={value} checked={attendanceMode === value} onChange={() => setAttendanceMode(value)} className="h-4 w-4 text-brand-600 focus:ring-brand-400" />
                            {text}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </div>
                </>
              )}

              {step === "questions" && event.questions.map((q) => <Question key={q.id} q={q} answers={answers} setAnswers={setAnswers} />)}

              {step === "review" && (
                <>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-normal text-slate-950">{event.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{event.whenLabel}</p>
                    <p className="text-sm text-slate-600">{event.whereLabel}</p>
                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
                      <span className="text-sm text-slate-600">{event.waitlist ? "Waitlist" : "1 ticket"}</span>
                      <span className="text-lg font-normal text-slate-950">
                        {event.waitlist ? "No charge" : event.priceLabel}
                        {event.paid && !event.waitlist && <span className="ml-1 text-sm text-slate-500">{event.currency}</span>}
                      </span>
                    </div>
                  </div>
                  <ReviewBlock title="Your details" onEdit={() => setStep("details")}>
                    <Row label="Name" value={fullName} />
                    <Row label="Email" value={email} />
                    {event.collectCompany && company && <Row label="Company" value={company} />}
                    {event.collectPhone && phone && <Row label="Phone" value={phone} />}
                    {event.format === "hybrid" && <Row label="Attending" value={attendanceMode === "online" ? "Online" : "In person"} />}
                  </ReviewBlock>
                  {event.questions.length > 0 && (
                    <ReviewBlock title="Your answers" onEdit={() => setStep("questions")}>
                      {event.questions.map((q) => (
                        <Row key={q.id} label={q.label} value={answerText(q)} />
                      ))}
                    </ReviewBlock>
                  )}
                  {event.waitlist && <p className="rounded-xl bg-slate-100 p-3.5 text-sm text-slate-700">This event is full. We&apos;ll contact you if a spot opens.</p>}
                  {event.paid && !event.waitlist && (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      {event.onlinePayment
                        ? `You'll pay securely with Stripe on the next screen.${event.testMode ? " (Test mode: no real charges.)" : ""}`
                        : "Our team will follow up with you about payment after you register."}
                    </p>
                  )}
                  {errorMessage && (
                    <p role="alert" className="rounded-[10px] bg-rose-50 p-3 text-sm text-rose-700">
                      {errorMessage}
                    </p>
                  )}
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:px-8">
              {index > 0 ? (
                <button type="button" onClick={() => setStep(steps[index - 1])} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2.5 text-base text-slate-700 hover:bg-slate-100">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Back
                </button>
              ) : (
                <span className="text-sm text-slate-500">
                  Step {index + 1} of {steps.length}
                </span>
              )}
              <button type="submit" disabled={isPending} className={PRIMARY}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    Sending…
                  </>
                ) : (
                  <>
                    {step === "review" ? submitLabel : "Continue"}
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </>
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}

function Question({ q, answers, setAnswers }: { q: RegistrationQuestion; answers: RegistrationAnswers; setAnswers: (a: RegistrationAnswers) => void }) {
  const id = `q-${q.id}`;
  const optional = !q.required && <span className="text-slate-400"> (optional)</span>;
  if (q.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 rounded-[10px] border border-slate-200 p-3.5 text-base text-slate-800 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
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
      <fieldset>
        <legend className={LABEL}>
          {q.label}
          {optional}
        </legend>
        <div className="mt-1.5 space-y-1.5">
          {q.options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-base text-slate-800 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
              <input type="radio" name={id} required={q.required} value={o} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} className="h-4 w-4 text-brand-600 focus:ring-brand-400" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <div>
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
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-normal text-slate-950">{title}</p>
        <button type="button" onClick={onEdit} className="text-sm text-brand-700 hover:underline">
          Edit
        </button>
      </div>
      <dl className="mt-1.5 divide-y divide-slate-100 rounded-2xl border border-slate-200">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-slate-900">{value}</dd>
    </div>
  );
}

function Done({ event, result, onClose }: { event: FlowEvent; result: RegisterResult; onClose: () => void }) {
  if (result.status === "checkout") {
    return (
      <div className="flex items-center gap-3 px-6 py-10 text-base text-slate-700 sm:px-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" strokeWidth={2} />
        Taking you to secure checkout…
      </div>
    );
  }
  const waitlisted = result.status === "waitlisted";
  return (
    <div className="space-y-5 px-6 py-8 sm:px-8">
      <div className="flex items-start gap-3">
        <CheckCircle2 className={`h-8 w-8 shrink-0 ${waitlisted ? "text-slate-500" : "text-emerald-600"}`} strokeWidth={1.75} />
        <div className="text-base text-slate-700">
          <p className="whitespace-pre-line">
            {waitlisted ? "Our team will contact you if a spot opens." : (result.confirmationMessage ?? "We have your spot saved. See you there.")}
          </p>
          {waitlisted && result.confirmationMessage && <p className="mt-2 whitespace-pre-line">{result.confirmationMessage}</p>}
          {result.paymentPending && <p className="mt-2">Our team will be in touch about payment.</p>}
        </div>
      </div>
      {!waitlisted && (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-normal text-slate-950">{event.title}</p>
          <p className="mt-1">{event.whenLabel}</p>
          <p>{event.whereLabel}</p>
          {result.onlineUrl && (
            <p className="mt-2">
              Join online:{" "}
              <a href={result.onlineUrl} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">
                {result.onlineUrl}
              </a>
            </p>
          )}
          {result.ticketCode && (
            <p className="mt-2">
              Ticket number <span className="font-mono text-slate-950">{result.ticketCode.slice(0, 8).toUpperCase()}</span>
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {!waitlisted && (
          <a href={event.calendarUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 px-4 py-2.5 text-base text-slate-800 hover:bg-slate-50">
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
            Add to calendar
          </a>
        )}
        <button type="button" onClick={onClose} className={PRIMARY}>
          Done
        </button>
      </div>
    </div>
  );
}
