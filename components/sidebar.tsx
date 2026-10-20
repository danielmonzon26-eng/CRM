"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, TEAM_LINK } from "@/components/nav-links";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ isAdmin, openTaskCount }: { isAdmin: boolean; openTaskCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-ink-950 lg:flex">
      <div className="flex h-14 items-center gap-1.5 border-b border-white/10 px-5">
        <span className="text-base font-bold tracking-wide text-white">CATAPULT</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_LINKS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </span>
              {item.showTaskBadge && openTaskCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    active ? "bg-white text-brand-700" : "bg-white/10 text-ink-100"
                  }`}
                >
                  {openTaskCount}
                </span>
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href={TEAM_LINK.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(pathname, TEAM_LINK.href)
                ? "bg-brand-600 text-white"
                : "text-ink-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <TEAM_LINK.icon className="h-4 w-4" strokeWidth={2} />
            {TEAM_LINK.label}
          </Link>
        )}
      </nav>
    </aside>
  );
}
