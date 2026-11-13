import Link from "next/link";
import { GlobalSearch } from "@/components/global-search";
import { MobileNavDrawer, NotificationsLink, QuickCreateMenu, UserMenu } from "@/components/topbar-menus";
import { buttonClass } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/session";
import type { NavCounts } from "@/components/nav-links";

export function Topbar({
  user,
  counts,
  isAdmin,
}: {
  user: CurrentUser | null;
  counts: NavCounts;
  isAdmin: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <MobileNavDrawer isAdmin={isAdmin} counts={counts} />
      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {user ? (
          <>
            <QuickCreateMenu />
            <NotificationsLink openTaskCount={counts.tasks} />
            <UserMenu user={user} isAdmin={isAdmin} />
          </>
        ) : (
          <Link href="/login" className={buttonClass("primary")}>Sign in</Link>
        )}
      </div>
    </header>
  );
}
