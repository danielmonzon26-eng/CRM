"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/budgets", label: "Dashboard" },
  { href: "/budgets/items", label: "Budget" },
  { href: "/budgets/analysis", label: "Cost & revenue" },
];

export function BudgetTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Budget views" className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
