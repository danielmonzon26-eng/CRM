"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Building2, CalendarPlus, CornerDownLeft, Search, Ticket, User } from "lucide-react";
import { CRM_LINKS, EVENT_TABS, OVERVIEW_TAB, WORK_TABS } from "@/components/nav-links";

type SearchResult = {
  events: { id: string; title: string; program: string | null }[];
  companies: { id: string; name: string; community: string | null }[];
  contacts: { id: string; full_name: string; email: string | null; lead_id: string }[];
};
type Command = { id: string; group: string; label: string; hint?: string | null; icon: LucideIcon; href: string };

const COMMANDS: Command[] = [
  { id: "new-event", group: "Actions", label: "Create an event", icon: CalendarPlus, href: "/events/new" },
  ...[OVERVIEW_TAB, ...EVENT_TABS, ...CRM_LINKS, ...WORK_TABS].map((link) => ({
    id: `go-${link.label}`,
    group: "Go to",
    label: link.label === "Dashboard" ? "CRM dashboard" : link.label,
    icon: link.icon,
    href: link.href,
  })),
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    setQuery("");
    setResults(null);
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    setActiveIndex(0);
    if (trimmed.length < 2) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const controller = new AbortController();
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`Search returned ${r.status}`);
          return r.json();
        })
        .then((data) => {
          setResults(data);
          setSearchFailed(false);
          setIsSearching(false);
        })
        .catch((e) => {
          // A new keystroke cancels the old search; that isn't a failure.
          if (e instanceof DOMException && e.name === "AbortError") return;
          setResults(null);
          setSearchFailed(true);
          setIsSearching(false);
        });
    }, 200);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const items = useMemo<Command[]>(() => {
    const lower = query.trim().toLowerCase();
    const commands = COMMANDS.filter((c) => !lower || c.label.toLowerCase().includes(lower));
    const found: Command[] = results
      ? [
          ...results.events.map((e) => ({ id: `event-${e.id}`, group: "Events", label: e.title, hint: e.program, icon: Ticket, href: `/events/${e.id}` })),
          ...results.companies.map((c) => ({ id: `company-${c.id}`, group: "Companies", label: c.name, hint: c.community, icon: Building2, href: `/companies/${c.id}` })),
          ...results.contacts.map((c) => ({ id: `contact-${c.id}`, group: "Contacts", label: c.full_name, hint: c.email, icon: User, href: `/leads/${c.lead_id}` })),
        ]
      : [];
    return [...found, ...commands];
  }, [query, results]);

  function choose(item: Command | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const activeId = items[activeIndex] ? `command-${items[activeIndex].id}` : undefined;
  let previousGroup = "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-lg items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-2.5 text-left text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-white"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate">Search or jump to...</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 lg:block">⌘K</kbd>
      </button>

      {open && (
        <div
          className="animate-fade fixed inset-0 z-50 bg-ink-950/50 p-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Search and commands" className="animate-pop mx-auto flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-popover">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-activedescendant={activeId}
                aria-label="Search events, companies, contacts, and pages"
                placeholder="Search events, companies, contacts, and pages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    choose(items[activeIndex]);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
              />
              {isSearching && <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />}
            </div>

            <div ref={listRef} id="command-list" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
              {searchFailed && !isSearching && (
                <p role="alert" className="mx-2 my-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Search didn&apos;t load. Try again in a moment.</p>
              )}
              {items.length === 0 && !isSearching && !searchFailed && <p className="px-3 py-8 text-center text-sm text-slate-500">No matches for &quot;{query.trim()}&quot;.</p>}
              {items.map((item, index) => {
                const Icon = item.icon;
                const heading = item.group !== previousGroup ? item.group : null;
                previousGroup = item.group;
                const active = index === activeIndex;
                return (
                  <div key={item.id}>
                    {heading && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{heading}</p>}
                    <div
                      id={`command-${item.id}`}
                      role="option"
                      aria-selected={active}
                      data-index={index}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => choose(item)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${active ? "bg-brand-50 text-brand-800" : "text-slate-700"}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-slate-400"}`} strokeWidth={2} />
                      <span className="min-w-0 truncate">{item.label}</span>
                      {item.hint && <span className="min-w-0 truncate text-xs text-slate-500">{item.hint}</span>}
                      {active && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-brand-600" strokeWidth={2} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 sm:flex">
              <span>↑↓ to move</span>
              <span>Enter to open</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
