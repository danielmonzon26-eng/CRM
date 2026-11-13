"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/marketing/social", label: "Post calendar" },
  { href: "/marketing/social/approvals", label: "Approvals" },
  { href: "/marketing/social/channels", label: "Channels" },
];

/** The second row of tabs inside Social. */
export function SocialTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Social sections" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {TABS.map((t) => {
        const active = t.href === "/marketing/social" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
