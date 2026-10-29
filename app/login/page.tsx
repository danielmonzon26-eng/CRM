"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { signInWithPassword, requestPasswordReset, verifyResetCode } from "./actions";

type Mode = "signin" | "forgot-email" | "forgot-code";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function resetForgotFlow() {
    setMode("signin");
    setError(null);
    setCode("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-popover">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-wide text-slate-900">CATAPULT</h1>
          <p className="mt-0.5 text-xs leading-tight text-slate-500">Sign in to access your CRM</p>
        </div>

        {mode === "forgot-email" && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await requestPasswordReset(email);
                if (result?.error) setError(result.error);
                else setMode("forgot-code");
              });
            }}
          >
            <p className="text-sm text-slate-500">Enter your email and we'll send you a 6-digit code.</p>
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
              {isPending ? "Sending..." : "Send code"}
            </button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="button" onClick={resetForgotFlow} className="text-xs text-slate-500 hover:text-slate-700">
              ← Back to sign in
            </button>
          </form>
        )}

        {mode === "forgot-code" && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await verifyResetCode(email, code);
                if (result?.error) setError(result.error);
                else router.push("/auth/reset-password");
              });
            }}
          >
            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              We sent a 6-digit code to {email}. Enter it below.
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Verifying..." : "Verify code"}
            </button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot-email");
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ← Use a different email
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await requestPasswordReset(email);
                    if (result?.error) setError(result.error);
                  })
                }
                className="text-brand-600 hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {mode === "signin" && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await signInWithPassword(email, password);
                if (result?.error) setError(result.error);
                else router.push("/");
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
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot-email");
                    setError(null);
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Sign in"}
            </button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
