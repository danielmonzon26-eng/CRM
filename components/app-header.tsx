import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export async function AppHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm sm:px-6">
      {user.role === "admin" && (
        <Link href="/team" className="text-slate-500 hover:text-slate-900">
          Team
        </Link>
      )}
      <span className="text-slate-500">{user.fullName ?? user.email}</span>
      <SignOutButton />
    </div>
  );
}
