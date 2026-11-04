"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Waits a moment before showing, so fast navigations don't flash a bar.
const SHOW_AFTER_MS = 120;

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      timer = setTimeout(() => setPhase("loading"), SHOW_AFTER_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimeout(timer);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    setPhase((current) => (current === "loading" ? "done" : "idle"));
    const timer = setTimeout(() => setPhase("idle"), 250);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (phase === "idle") return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className={`fixed left-0 top-0 z-50 h-0.5 bg-brand-500 ${phase === "loading" ? "route-progress-loading" : "route-progress-done"}`}
    />
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
