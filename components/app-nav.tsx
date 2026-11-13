"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CRM_LINKS,
  CRM_TAB,
  EVENT_TABS,
  OVERVIEW_TAB,
  TEAM_LINK,
  WORK_TABS,
  isActive,
  isCrmPath,
  type NavCounts,
  type NavLink,
} from "@/components/nav-links";

export function AppNav({
  isAdmin,
  counts,
  collapsed = false,
  onNavigate,
}: {
  isAdmin: boolean;
  counts: NavCounts;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const inCrm = isCrmPath(pathname);

  const renderItem = (item: NavLink, nested = false) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    const badge = item.badge ? counts[item.badge] : 0;
    const badgeLabel =
      item.badge === "mail" ? `${badge} new ${badge === 1 ? "email" : "emails"}` : item.badge === "approvals" ? `${badge} waiting approval` : `${badge} open`;
    return (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed || badge > 0 ? `${item.label}${badge > 0 ? `, ${badgeLabel}` : ""}` : undefined}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
          collapsed ? "h-10 justify-center" : "justify-between px-3 py-2"
        } ${active ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"}`}
      >
        <span className="flex items-center gap-2.5">
          <Icon className={nested ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2} />
          {!collapsed && item.label}
        </span>
        {badge > 0 &&
          (collapsed ? (
            <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
          ) : (
            <span
              aria-hidden="true"
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                active ? "bg-white text-brand-700" : item.badge === "mail" || item.badge === "approvals" ? "bg-brand-500 text-white" : "bg-white/10 text-ink-100"
              }`}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          ))}
      </Link>
    );
  };

  return (
    <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {renderItem(OVERVIEW_TAB)}
      {EVENT_TABS.map((item) => renderItem(item))}

      <Link
        href={CRM_TAB.href}
        onClick={onNavigate}
        title={collapsed ? CRM_TAB.label : undefined}
        aria-label={collapsed ? CRM_TAB.label : undefined}
        aria-expanded={inCrm}
        className={`relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
          collapsed ? "h-10 justify-center" : "px-3 py-2"
        } ${inCrm ? "text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"}`}
      >
        <CRM_TAB.icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {!collapsed && CRM_TAB.label}
        {!inCrm && counts.mail > 0 && (
          <span
            title={`${counts.mail} new ${counts.mail === 1 ? "email" : "emails"} in Communication`}
            className={collapsed ? "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" : "ml-auto h-2 w-2 rounded-full bg-brand-500"}
          >
            <span className="sr-only">, new email in Communication</span>
          </span>
        )}
      </Link>
      {inCrm && (
        <div className={collapsed ? "space-y-1" : "ml-5 space-y-0.5 border-l border-white/10 pl-2"}>
          {CRM_LINKS.map((item) => renderItem(item, true))}
        </div>
      )}

      {WORK_TABS.map((item) => renderItem(item))}
      {isAdmin && renderItem(TEAM_LINK)}
    </nav>
  );
}
