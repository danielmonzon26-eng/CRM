"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { VersionStamp, Wordmark } from "@/components/wordmark";

export const SIDEBAR_COOKIE = "sidebar-collapsed";

export function Sidebar({
  isAdmin,
  openTaskCount,
  initialCollapsed,
}: {
  isAdmin: boolean;
  openTaskCount: number;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie, not localStorage, so the server renders the right width with no flash.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-ink-950 transition-[width] duration-150 lg:flex ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <div className={`flex h-16 items-center border-b border-white/10 ${collapsed ? "justify-center" : "px-5"}`}>
        <Wordmark collapsed={collapsed} />
      </div>

      {!collapsed && (
        <div className="border-b border-white/10 px-5 py-2.5">
          <VersionStamp />
        </div>
      )}

      <AppNav isAdmin={isAdmin} openTaskCount={openTaskCount} collapsed={collapsed} />

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-lg text-sm font-medium text-ink-200 hover:bg-white/5 hover:text-white ${
            collapsed ? "h-10 justify-center" : "px-3 py-2"
          }`}
        >
          <ToggleIcon className="h-[18px] w-[18px]" strokeWidth={2} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
