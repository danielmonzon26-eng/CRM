import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamMembers } from "@/lib/leads/queries";
import { RoleSelect } from "@/components/role-select";
import { getInitials } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Only admins can manage the team.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← Back to board
        </Link>
      </main>
    );
  }

  const members = await getTeamMembers();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to board
      </Link>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Team</h1>
      <p className="text-sm text-slate-500">Admins can manage every lead and promote/demote roles.</p>

      <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {getInitials(m.fullName ?? m.email)}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">{m.fullName ?? m.email ?? m.id}</p>
                {m.fullName && <p className="text-xs text-slate-500">{m.email}</p>}
              </div>
            </div>
            <RoleSelect profileId={m.id} role={m.role} />
          </div>
        ))}
      </div>
    </main>
  );
}
