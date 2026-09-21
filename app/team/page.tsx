import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamMembers } from "@/lib/leads/queries";
import { RoleSelect } from "@/components/role-select";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Only admins can manage the team.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Back to board
        </Link>
      </main>
    );
  }

  const members = await getTeamMembers();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Back to board
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Team</h1>
      <p className="text-sm text-slate-500">Admins can manage every lead and promote/demote roles.</p>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{m.fullName ?? m.email ?? m.id}</p>
              {m.fullName && <p className="text-xs text-slate-500">{m.email}</p>}
            </div>
            <RoleSelect profileId={m.id} role={m.role} />
          </div>
        ))}
      </div>
    </main>
  );
}
