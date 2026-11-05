"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNewPassword } from "@/app/auth/reset-password/actions";
import { acceptInvite } from "./actions";

const FIELD = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function AcceptForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Once the link is used it can't be used again, so a retry only needs to set the password.
  const [verified, setVerified] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) {
          setError("Passwords don't match");
          return;
        }
        startTransition(async () => {
          try {
            const result = verified ? await setNewPassword(password) : await acceptInvite(tokenHash, type, password);
            if ("verified" in result && result.verified) setVerified(true);
            if (result.error) setError(result.error);
            else router.push("/");
          } catch {
            setError("Your password wasn't set. Please try again.");
          }
        });
      }}
    >
      <label className="text-sm font-medium text-slate-700">
        New password
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={FIELD} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Confirm password
        <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} />
      </label>
      <button type="submit" disabled={isPending} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {isPending ? "Saving..." : "Set password and sign in"}
      </button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
