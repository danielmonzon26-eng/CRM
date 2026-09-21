"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      className="text-sm text-slate-500 hover:text-slate-900 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
