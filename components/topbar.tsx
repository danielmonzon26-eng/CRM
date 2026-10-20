import Link from "next/link";
import { GlobalSearch } from "@/components/global-search";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileNav } from "@/components/mobile-nav";
import { getInitials } from "@/lib/text";
import type { CurrentUser } from "@/lib/auth/session";

export function Topbar({
  user,
  openTaskCount,
  isAdmin,
}: {
  user: CurrentUser | null;
  openTaskCount: number;
  isAdmin: boolean;
}) {
  const displayName = user?.fullName ?? user?.email ?? "Unknown";

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:gap-4 lg:py-0">
      <div className="flex h-10 items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
            C
          </div>
          <span className="text-sm font-semibold text-slate-900">Calgary Lead Engine</span>
        </div>
      </div>

      <MobileNav isAdmin={isAdmin} openTaskCount={openTaskCount} />

      <div className="flex min-h-14 flex-1 items-center gap-3">
        <div className="flex-1">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-slate-900">{displayName}</p>
                <p className="text-xs capitalize leading-tight text-slate-400">{user.role}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {getInitials(displayName)}
              </div>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
