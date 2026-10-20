"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      title="Sign out"
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
