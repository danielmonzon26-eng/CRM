"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Columns3, Radio, Target } from "lucide-react";

const TABS = [
  { href: "/marketing", label: "Planner", icon: CalendarDays },
  { href: "/marketing/approvals", label: "Approvals", icon: Columns3 },
  { href: "/marketing/initiatives", label: "Initiatives", icon: Target },
  { href: "/marketing/channels", label: "Channels", icon: Radio },
];

/** The four parts of Marketing, as tabs under the page title. */
export function MarketingTabs({ waitingCount }: { waitingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketing sections" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {TABS.map((tab) => {
        const active = tab.href === "/marketing" ? pathname === "/marketing" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {tab.label}
            {tab.label === "Approvals" && waitingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-900">
                {waitingCount}
                <span className="sr-only"> waiting approval</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
