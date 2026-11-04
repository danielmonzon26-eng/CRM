"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  leads: "Leads",
  companies: "Companies",
  contacts: "Contacts",
  deals: "Deals",
  tasks: "Tasks",
  team: "Team",
  budgets: "Budgets",
  events: "Events",
  calendar: "Calendar",
  new: "New",
  edit: "Edit",
};

const CRM_SECTIONS = new Set(["leads", "companies", "contacts", "deals"]);

export function Breadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => ({
    label: LABELS[segment] ?? "Details",
    href: `/${segments.slice(0, i + 1).join("/")}`,
  }));
  if (CRM_SECTIONS.has(segments[0])) crumbs.unshift({ label: "CRM", href: "/" });

  return (
    <nav aria-label="Breadcrumb" className="px-4 pt-4 sm:px-6 lg:px-8">
      <ol className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1 text-xs text-slate-500">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400" strokeWidth={2} />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-slate-700">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-slate-900">{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
