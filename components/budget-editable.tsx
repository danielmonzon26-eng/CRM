"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFeedback } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/budgets/money";

type SaveResult = { error?: string };

/** A value that reads as text until clicked. Enter or leaving saves, and Esc cancels. */
function EditableField({
  label,
  display,
  initial,
  inputProps,
  onSave,
  className = "",
  align = "left",
  isSame,
}: {
  label: string;
  display: React.ReactNode;
  initial: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  onSave: (value: string) => Promise<SaveResult>;
  className?: string;
  align?: "left" | "right";
  isSame: (next: string) => boolean;
}) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [pendingDisplay, setPendingDisplay] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Once fresh data arrives from the server, it replaces the value shown while saving.
  useEffect(() => {
    setPendingDisplay(null);
  }, [initial]);

  function commit() {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (isSame(draft)) return;
    setPendingDisplay(draft);
    startTransition(async () => {
      const result = await onSave(draft);
      if (result.error) {
        setPendingDisplay(null);
        setDraft(initial);
        toast(`${label}: ${result.error}`, "error");
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            setDraft(initial);
            e.currentTarget.blur();
          }
        }}
        className={`w-full min-w-20 rounded-md border border-brand-400 bg-white px-1.5 py-1 text-sm outline-none ring-2 ring-brand-100 ${align === "right" ? "text-right" : ""} ${className}`}
        {...inputProps}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Edit ${label}`}
      title="Click to edit"
      onClick={() => {
        setDraft(initial);
        setEditing(true);
      }}
      className={`rounded-md border border-transparent px-1.5 py-1 text-sm transition-colors hover:border-slate-300 hover:bg-white ${align === "right" ? "text-right" : "text-left"} ${isPending ? "opacity-60" : ""} ${className}`}
    >
      {pendingDisplay !== null ? (align === "right" ? formatMoney(Number(pendingDisplay) || 0) : pendingDisplay) : display}
    </button>
  );
}

export function EditableMoney({ label, value, onSave }: { label: string; value: number; onSave: (value: string) => Promise<SaveResult> }) {
  return (
    <EditableField
      label={label}
      align="right"
      className="tabular-nums text-slate-700"
      display={formatMoney(value)}
      initial={String(value)}
      inputProps={{ inputMode: "decimal" }}
      isSame={(next) => Number(next) === value}
      onSave={onSave}
    />
  );
}

export function EditableText({ label, value, onSave, className }: { label: string; value: string; onSave: (value: string) => Promise<SaveResult>; className?: string }) {
  return (
    <EditableField
      label={label}
      className={className}
      display={value}
      initial={value}
      isSame={(next) => next.trim() === value}
      onSave={onSave}
    />
  );
}
