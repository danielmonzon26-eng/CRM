import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare2,
  Handshake,
  Home,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon; showTaskBadge?: boolean };

export const OVERVIEW_TAB: NavLink = { href: "/", label: "Overview", icon: Home };

export const EVENT_TABS: NavLink[] = [
  { href: "/events", label: "Events", icon: Ticket },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export const CRM_TAB: NavLink = { href: "/crm", label: "CRM", icon: Briefcase };

export const CRM_LINKS: NavLink[] = [
  { href: "/crm", label: "Dashboard", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: ListChecks },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/deals", label: "Deals", icon: Handshake },
];

export const WORK_TABS: NavLink[] = [
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2, showTaskBadge: true },
];

export const TEAM_LINK: NavLink = { href: "/team", label: "Team", icon: ShieldCheck };

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isCrmPath(pathname: string): boolean {
  return CRM_LINKS.some((link) => isActive(pathname, link.href));
}
