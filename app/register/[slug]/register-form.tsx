"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { registerForEvent, type RegisterResult } from "./actions";
import type { EventFormat } from "@/lib/supabase/types";

const INPUT =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "text-xs font-medium text-slate-500";

const ERROR_MESSAGES: Partial<Record<RegisterResult["status"], string>> = {
  already_registered: "This email is already registered for this event. Contact us if you need your details again.",
  sold_out: "Sorry, this event just sold out.",
  closed: "Registration for this event has closed.",
  not_found: "This event is no longer available.",
  invalid: "Please check your name and email address.",
  error: "Something went wrong. Please try again.",
};

export function RegisterForm({ slug, format }: { slug: string; format: EventFormat }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("in_person");
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result?.status === "registered") {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          You&apos;re registered
        </p>
        <p className="mt-1">We have your spot saved. See you there.</p>
        {result.onlineUrl && (
          <p className="mt-2">
            Join online:{" "}
            <a href={result.onlineUrl} target="_blank" rel="noreferrer" className="break-all font-medium underline">
              {result.onlineUrl}
            </a>
          </p>
        )}
        {result.ticketCode && (
          <p className="mt-2 text-xs">
            Your ticket number: <span className="font-mono">{result.ticketCode.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
      </div>
    );
  }

  const errorMessage = result ? ERROR_MESSAGES[result.status] : null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => {
          setResult(
            await registerForEvent({
              slug,
              fullName,
              email,
              phone,
              company,
              website,
              attendanceMode: format === "hybrid" ? attendanceMode : null,
            })
          );
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
      <div>
        <label className={LABEL} htmlFor="company">Company (optional)</label>
        <input id="company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT} />
      </div>
      <div>
        <label className={LABEL} htmlFor="phone">Phone (optional)</label>
        <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
      </div>
      {format === "hybrid" && (
        <div>
          <label className={LABEL} htmlFor="attendanceMode">How will you attend?</label>
          <select id="attendanceMode" value={attendanceMode} onChange={(e) => setAttendanceMode(e.target.value)} className={INPUT}>
            <option value="in_person">In person</option>
            <option value="online">Online / livestream</option>
          </select>
        </div>
      )}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {isPending ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
