"use client";

import { useState, useTransition } from "react";
import { sendMagicLink } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-slate-900">Calgary Lead Engine</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to access the CRM.</p>

      {sent ? (
        <p className="mt-6 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Check your email for a sign-in link.
        </p>
      ) : (
        <form
          className="mt-6 flex flex-col gap-3"
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
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Send sign-in link"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
