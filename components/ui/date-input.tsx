"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date field with a large, easy calendar instead of the browser's small one. Drop-in for
 * <input type="date">: same value format (YYYY-MM-DD), and onChange gets { target: { value } }.
 * Works controlled (value) or uncontrolled (defaultValue + name, for forms). The calendar opens
 * in the browser's top layer, so dialogs and scrolling tables never cut it off.
 */

type ChangeEvent = { target: { value: string; name?: string } };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shown = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shownCompact = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const spoken = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);
function addDays(day: string, n: number) {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
}
function addMonths(day: string, n: number) {
  const d = toDate(day);
  const want = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(want, last));
  return key(d);
}
function localToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function DateInput({
  value,
  defaultValue,
  onChange,
  name,
  id,
  min,
  max,
  required,
  disabled,
  className = "",
  placeholder = "Pick a date",
  "aria-label": ariaLabel,
  title,
  compact = false,
}: {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (event: ChangeEvent) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  title?: string;
  /** Leave out the weekday, for narrow table cells. */
  compact?: boolean;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = (controlled ? value : inner) ?? "";
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(() => (isDay(current) ? current : localToday()));
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const gridId = useId();

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInner(next);
      onChange?.({ target: { value: next, name } });
    },
    [controlled, onChange, name],
  );

  const outOfRange = (day: string) => (isDay(min) && day < min) || (isDay(max) && day > max);

  function openPicker() {
    if (disabled) return;
    setFocusDay(isDay(current) ? current : isDay(min) && localToday() < min ? min : localToday());
    setOpen(true);
  }

  // An uncontrolled field goes back to its starting value when its form is reset.
  useEffect(() => {
    if (controlled) return;
    const form = trigger.current?.closest("form");
    if (!form) return;
    const reset = () => setInner(defaultValue ?? "");
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);

  // Place the calendar under the field (or above it near the bottom of the screen).
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el || !trigger.current) return;
    try {
      el.showPopover?.();
    } catch {
      /* already open */
    }
    const r = trigger.current.getBoundingClientRect();
    const h = el.offsetHeight || 380;
    const w = el.offsetWidth || 320;
    const below = r.bottom + 6 + h <= window.innerHeight || r.top < h + 6;
    el.style.top = `${Math.max(8, below ? r.bottom + 6 : r.top - h - 6)}px`;
    el.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - w - 8)}px`;
  }, [open, focusDay]);

  // Keep keyboard focus on the highlighted day while the calendar is open.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay]);

  // A click outside, scrolling the page, or resizing closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    const shut = () => close(false);
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("resize", shut);
    };
  });

  function close(refocus = true) {
    try {
      panel.current?.hidePopover?.();
    } catch {
      /* not open */
    }
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  function pick(day: string) {
    if (outOfRange(day)) return;
    commit(day);
    close();
  }

  function onKey(e: React.KeyboardEvent) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDay, e.shiftKey ? 12 : 1),
      Home: () => addDays(focusDay, -((toDate(focusDay).getUTCDay() + 6) % 7)),
      End: () => addDays(focusDay, 6 - ((toDate(focusDay).getUTCDay() + 6) % 7)),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocusDay(moves[e.key]());
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also close a dialog it sits in
      close();
    }
  }

  const view = toDate(focusDay);
  const year = view.getUTCFullYear();
  const month = view.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => key(new Date(Date.UTC(year, month, 1 - lead + i))));
  const today = localToday();
  const years = Array.from({ length: 13 }, (_, i) => year - 6 + i);

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel ? `${ariaLabel}${current ? `: ${spoken.format(toDate(current))}` : ""}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`${className} inline-flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${isDay(current) ? "" : "text-slate-400"}`}>{isDay(current) ? (compact ? shownCompact : shown).format(toDate(current)) : placeholder}</span>
        <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
      </button>

      {open && (
        <div
          ref={panel}
          popover="manual"
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel ? `Choose ${ariaLabel.toLowerCase()}` : "Choose a date"}
          onKeyDown={onKey}
          className="m-0 w-[320px] rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-popover"
          style={{ position: "fixed", inset: "auto" }}
        >
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous month" onClick={() => setFocusDay(addMonths(focusDay, -1))} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => setFocusDay(key(new Date(Date.UTC(year, Number(e.target.value), Math.min(view.getUTCDate(), new Date(Date.UTC(year, Number(e.target.value) + 1, 0)).getUTCDate())))))}
              className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold hover:border-slate-200"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => setFocusDay(addMonths(focusDay, (Number(e.target.value) - year) * 12))}
              className="w-[5.5rem] rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold hover:border-slate-200"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button type="button" aria-label="Next month" onClick={() => setFocusDay(addMonths(focusDay, 1))} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div role="grid" aria-labelledby={gridId} className="mt-2">
            <span id={gridId} className="sr-only">
              {MONTHS[month]} {year}
            </span>
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((d) => (
                <span key={d} role="columnheader" className="py-1 text-center text-xs font-medium text-slate-500">
                  {d}
                </span>
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} role="row" className="grid grid-cols-7 gap-0.5">
                {cells.slice(row * 7, row * 7 + 7).map((day) => {
                  const inMonth = toDate(day).getUTCMonth() === month;
                  const selected = day === current;
                  const isToday = day === today;
                  const blocked = outOfRange(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      role="gridcell"
                      data-day={day}
                      tabIndex={day === focusDay ? 0 : -1}
                      aria-selected={selected}
                      aria-disabled={blocked || undefined}
                      aria-label={`${spoken.format(toDate(day))}${isToday ? ", today" : ""}`}
                      onClick={() => pick(day)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          pick(day);
                        }
                      }}
                      className={`flex h-10 items-center justify-center rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                        selected
                          ? "bg-brand-600 font-semibold text-white"
                          : blocked
                            ? "cursor-not-allowed text-slate-300"
                            : inMonth
                              ? "text-slate-800 hover:bg-brand-50"
                              : "text-slate-400 hover:bg-slate-50"
                      } ${isToday && !selected ? "font-semibold ring-1 ring-inset ring-brand-400" : ""}`}
                    >
                      {toDate(day).getUTCDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" disabled={outOfRange(today)} onClick={() => pick(today)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40">
              Today
            </button>
            <div className="flex gap-1">
              {!required && current && (
                <button
                  type="button"
                  onClick={() => {
                    commit("");
                    close();
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
              <button type="button" onClick={() => close()} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
