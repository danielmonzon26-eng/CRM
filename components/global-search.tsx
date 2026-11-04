"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchResult = {
  companies: { id: string; name: string; community: string | null }[];
  contacts: { id: string; full_name: string; email: string | null; lead_id: string }[];
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setResults(data));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleShortcut);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  const hasResults = results && (results.companies.length > 0 || results.contacts.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 lg:block">
        ⌘K
      </kbd>
      <input
        ref={inputRef}
        type="search"
        aria-label="Search companies and contacts"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search companies & contacts…"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-500 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 lg:pr-12"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-popover">
          {!results && <p className="px-3 py-3 text-xs text-slate-400">Searching…</p>}
          {results && !hasResults && <p className="px-3 py-3 text-xs text-slate-400">No matches.</p>}
          {results && results.companies.length > 0 && (
            <div className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Companies</p>
              {results.companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/companies/${c.id}`);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {c.name} {c.community && <span className="text-xs text-slate-400">· {c.community}</span>}
                </button>
              ))}
            </div>
          )}
          {results && results.contacts.length > 0 && (
            <div className="border-t border-slate-100 py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Contacts</p>
              {results.contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/leads/${c.lead_id}`);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {c.full_name} {c.email && <span className="text-xs text-slate-400">· {c.email}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
