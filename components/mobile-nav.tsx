"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, TEAM_LINK } from "@/components/nav-links";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ isAdmin, openTaskCount }: { isAdmin: boolean; openTaskCount: number }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_LINKS, TEAM_LINK] : NAV_LINKS;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto lg:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        const badge = item.showTaskBadge && openTaskCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
            {badge && (
              <span className="rounded-full bg-brand-600 px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
                {openTaskCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
