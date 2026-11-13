import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare2,
  Handshake,
  Home,
  LayoutDashboard,
  ListChecks,
  Mail,
  Megaphone,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

/** Which count, if any, shows beside the link. */
export type NavBadge = "tasks" | "mail" | "approvals";

/** The numbers behind the nav badges. */
export type NavCounts = Record<NavBadge, number>;

export type NavLink = { href: string; label: string; icon: LucideIcon; badge?: NavBadge };

export const OVERVIEW_TAB: NavLink = { href: "/", label: "Overview", icon: Home };

export const EVENT_TABS: NavLink[] = [
  { href: "/events", label: "Events", icon: Ticket },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export const CRM_TAB: NavLink = { href: "/crm", label: "CRM", icon: Briefcase };

export const CRM_LINKS: NavLink[] = [
  { href: "/crm", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crm/proposals", label: "Proposals", icon: Handshake },
  { href: "/leads", label: "Leads", icon: ListChecks },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/communication", label: "Communication", icon: Mail, badge: "mail" },
];

export const WORK_TABS: NavLink[] = [
  { href: "/marketing", label: "Marketing", icon: Megaphone, badge: "approvals" },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/tasks", label: "Assignments", icon: CheckSquare2, badge: "tasks" },
];

export const TEAM_LINK: NavLink = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function isActive(pathname: string, href: string): boolean {
  // The CRM dashboard is only itself; proposal pages (and old /deals links) light up Proposals.
  if (href === "/crm") return pathname === "/crm";
  if (href === "/crm/proposals" && (pathname === "/deals" || pathname.startsWith("/deals/"))) return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isCrmPath(pathname: string): boolean {
  return CRM_LINKS.some((link) => isActive(pathname, link.href));
}
