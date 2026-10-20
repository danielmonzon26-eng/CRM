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
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
          C
        </div>
        <span className="truncate text-sm font-semibold text-slate-900">Calgary Lead Engine</span>
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
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </span>
              {item.showTaskBadge && openTaskCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-700"
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
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
