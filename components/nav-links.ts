import type { LucideIcon } from "lucide-react";
import { Building2, CheckSquare2, Handshake, LayoutGrid, ListChecks, ShieldCheck, Users } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon; showTaskBadge?: boolean };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: ListChecks },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2, showTaskBadge: true },
];

export const TEAM_LINK: NavLink = { href: "/team", label: "Team", icon: ShieldCheck };
