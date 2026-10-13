import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenTaskCount } from "@/lib/tasks/queries";
import { SignOutButton } from "@/components/sign-out-button";
import { GlobalSearch } from "@/components/global-search";

const NAV_LINKS = [
  { href: "/", label: "Pipeline" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/tasks", label: "Tasks" },
];

export async function AppHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  const openTaskCount = await getOpenTaskCount().catch(() => 0);

  return (
    <div className="border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center justify-between gap-4 py-2">
        <nav className="flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-md px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
              {link.href === "/tasks" && openTaskCount > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                  {openTaskCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <GlobalSearch />

        <div className="flex shrink-0 items-center gap-4 text-sm">
          {user.role === "admin" && (
            <Link href="/team" className="text-slate-500 hover:text-slate-900">
              Team
            </Link>
          )}
          <span className="text-slate-500">{user.fullName ?? user.email}</span>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
