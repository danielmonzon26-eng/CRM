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
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs capitalize text-slate-700 disabled:opacity-50"
    >
      <option value="rep">Rep</option>
      <option value="admin">Admin</option>
    </select>
  );
}
