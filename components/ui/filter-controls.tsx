"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

const SEARCH_ABOVE = 8;

/** The app's keyword search box, with a clear button and an optional loading spinner. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  isLoading = false,
  className = "",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`group relative min-w-56 ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-brand-600" strokeWidth={2} />
      <input
        ref={inputRef}
        // Not type="search", so browsers don't add their own clear button beside this one.
        type="text"
        role="searchbox"
        enterKeyHint="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {isLoading ? (
        <span aria-hidden="true" className="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
      ) : value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

export type FilterOption = { value: string; label: string; count?: number; group?: string };

/**
 * A filter dropdown that shows its name and current choice. Long lists get a search box, and
 * options can sit under group headings. "" is the unfiltered choice unless `required` is set.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
  required = false,
  className = "",
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);

  const all = useMemo<FilterOption[]>(() => (required ? options : [{ value: "", label: allLabel }, ...options]), [options, required, allLabel]);
  const searchable = options.length > SEARCH_ABOVE;
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? all.filter((o) => o.label.toLowerCase().includes(term) || o.group?.toLowerCase().includes(term)) : all;
  }, [all, query]);

  const selected = all.find((o) => o.value === value);
  const isFiltered = !required && value !== "";
  const optionId = (index: number) => `${id}-option-${index}`;

  function close(returnFocus: boolean) {
    setOpen(false);
    setQuery("");
    if (returnFocus) buttonRef.current?.focus();
  }

  function show() {
    const rect = buttonRef.current?.getBoundingClientRect();
    // Opens leftward when a menu this wide would run off the screen.
    setAlignRight(Boolean(rect && rect.left + 288 > window.innerWidth));
    setActive(Math.max(all.findIndex((o) => o.value === value), 0));
    setOpen(true);
  }

  function choose(option: FilterOption) {
    onChange(option.value);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : listRef.current)?.focus();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, shown]);

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home" && !searchable) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && !searchable) {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? allLabel}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex h-9 w-full items-center gap-1.5 rounded-lg border px-3 text-sm shadow-sm transition-colors ${
          isFiltered ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <span className={isFiltered ? "shrink-0 font-normal" : "shrink-0 text-slate-500"}>{label}</span>
        <span className="min-w-0 max-w-44 truncate font-medium">{selected?.label ?? allLabel}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${isFiltered ? "" : "text-slate-500"}`} strokeWidth={2.25} />
      </button>

      {open && (
        <div
          onKeyDown={onMenuKey}
          className={`animate-pop absolute top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-popover ${alignRight ? "right-0" : "left-0"}`}
        >
          {searchable && (
            <div className="relative border-b border-slate-100">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-list`}
                aria-activedescendant={shown[active] ? optionId(active) : undefined}
                aria-autocomplete="list"
                aria-label={`Find ${label.toLowerCase()}`}
                placeholder={`Find ${label.toLowerCase()}...`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          )}
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={!searchable && shown[active] ? optionId(active) : undefined}
            className="max-h-72 overflow-y-auto p-1 focus:outline-none"
          >
            {shown.length === 0 && <p role="status" className="px-3 py-6 text-center text-sm text-slate-500">No matches</p>}
            {shown.map((option, index) => {
              const isSelected = option.value === value;
              const startsGroup = option.group && option.group !== shown[index - 1]?.group;
              return (
                <div key={option.value || "__all"}>
                  {startsGroup && (
                    <p aria-hidden="true" className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{option.group}</p>
                  )}
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={option.group ? `${option.label}, ${option.group}` : undefined}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={`flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${index === active ? "bg-slate-100" : ""} ${isSelected ? "font-medium text-brand-800" : "text-slate-800"}`}
                  >
                    <span className="min-w-0 flex-1">{option.label}</span>
                    {option.count !== undefined && <span className="shrink-0 text-xs tabular-nums text-slate-500">{option.count.toLocaleString()}</span>}
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
