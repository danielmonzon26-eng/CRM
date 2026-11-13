"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Menu, Plus, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import type { NavCounts } from "@/components/nav-links";
import { buttonClass } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/use-dismiss";
import { VersionStamp, Wordmark } from "@/components/wordmark";
import { getInitials } from "@/lib/text";
import type { CurrentUser } from "@/lib/auth/session";

const MENU =
  "animate-pop absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-popover";
const MENU_ITEM = "block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";

function useMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  return { open, setOpen, close, ref };
}

export function QuickCreateMenu() {
  const { open, setOpen, close, ref } = useMenu();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={buttonClass("primary")}
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        <span className="hidden sm:inline">Create</span>
      </button>
      {open && (
        <div role="menu" className={MENU}>
          <Link role="menuitem" href="/events/new" onClick={close} className={MENU_ITEM}>New event</Link>
          <Link role="menuitem" href="/tasks" onClick={close} className={MENU_ITEM}>New task</Link>
          <Link role="menuitem" href="/leads" onClick={close} className={MENU_ITEM}>New proposal</Link>
        </div>
      )}
    </div>
  );
}

export function NotificationsLink({ openTaskCount }: { openTaskCount: number }) {
  const label = openTaskCount === 1 ? "1 open task" : `${openTaskCount} open tasks`;
  return (
    <Link
      href="/tasks"
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
      {openTaskCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {openTaskCount > 99 ? "99+" : openTaskCount}
        </span>
      )}
    </Link>
  );
}

export function UserMenu({ user, isAdmin }: { user: CurrentUser; isAdmin: boolean }) {
  const { open, setOpen, close, ref } = useMenu();
  const [isPending, startTransition] = useTransition();
  const displayName = user.fullName ?? user.email ?? "Unknown";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg p-1 hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-xs font-semibold text-white">
          {getInitials(displayName)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" className={MENU}>
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
            <p className="text-xs capitalize text-slate-500">{user.role}</p>
          </div>
          {isAdmin && (
            <Link role="menuitem" href="/admin" onClick={close} className={MENU_ITEM}>Admin</Link>
          )}
          <button
            role="menuitem"
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => signOut())}
            className={`${MENU_ITEM} flex items-center gap-2 disabled:opacity-50`}
          >
            <LogOut className="h-4 w-4 text-slate-400" strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileNavDrawer({ isAdmin, counts }: { isAdmin: boolean; counts: NavCounts }) {
  const { open, setOpen, close, ref } = useMenu();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
      </button>
      {open && (
        <div className="animate-fade fixed inset-0 z-40 bg-ink-950/50">
          <div ref={ref} role="dialog" aria-modal="true" aria-label="Menu" className="flex h-full w-72 max-w-[85%] flex-col bg-ink-950">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <Wordmark />
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-200 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="border-b border-white/10 px-5 py-2.5">
              <VersionStamp />
            </div>
            <AppNav isAdmin={isAdmin} counts={counts} onNavigate={close} />
          </div>
        </div>
      )}
    </div>
  );
}
