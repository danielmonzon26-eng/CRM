import type { LucideIcon } from "lucide-react";
import { Building2, CheckSquare2, LayoutGrid, ShieldCheck, Users } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon; showTaskBadge?: boolean };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Pipeline", icon: LayoutGrid },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2, showTaskBadge: true },
];

export const TEAM_LINK: NavLink = { href: "/team", label: "Team", icon: ShieldCheck };
