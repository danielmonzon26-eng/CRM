"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarRange, Handshake, LayoutDashboard, MessageSquareText, Ticket } from "lucide-react";

const TABS = [
  { href: "/marketing", label: "Overview", icon: LayoutDashboard },
  { href: "/marketing/planner", label: "Planner", icon: CalendarRange },
  { href: "/marketing/catapult", label: "Catapult", icon: Building2 },
  { href: "/marketing/event", label: "Event", icon: Ticket },
  { href: "/marketing/sponsorship", label: "Sponsorship", icon: Handshake },
  { href: "/marketing/social", label: "Social", icon: MessageSquareText },
];

/** Marketing's sections: the planner, the three streams (Catapult, Event, Sponsorship) and Social. */
export function MarketingTabs({ waitingCount }: { waitingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketing sections" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {TABS.map((tab) => {
        const active =
          tab.href === "/marketing"
            ? pathname === "/marketing"
            : tab.href === "/marketing/social"
              ? pathname.startsWith("/marketing/social") || pathname.startsWith("/marketing/posts")
              : tab.href === "/marketing/event"
                ? pathname.startsWith("/marketing/event") || pathname.startsWith("/marketing/promotion")
                : pathname.startsWith(tab.href);
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
            {tab.label === "Social" && waitingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-900">
                {waitingCount}
                <span className="sr-only"> posts waiting approval</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
