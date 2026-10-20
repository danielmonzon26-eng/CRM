"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { sendMagicLink } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-popover">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            C
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-900">Calgary Lead Engine</h1>
            <p className="text-xs leading-tight text-slate-500">Sign in to access the CRM</p>
          </div>
        </div>

        {sent ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            Check your email for a sign-in link.
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await sendMagicLink(email);
                if (result?.error) setError(result.error);
                else setSent(true);
              });
            }}
          >
            <div>
              <label className="text-xs font-medium text-slate-500">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send sign-in link"}
            </button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
