"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/app/actions/team";
import type { UserRole } from "@/lib/supabase/types";

export function RoleSelect({ profileId, role }: { profileId: string; role: UserRole }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={role}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateUserRole(profileId, e.target.value as UserRole))}
      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50"
    >
      <option value="rep">Rep</option>
      <option value="admin">Admin</option>
    </select>
  );
}
