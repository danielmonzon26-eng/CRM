"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

type Toast = { id: number; tone: "success" | "error"; text: string };
type DialogRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  danger: boolean;
  input?: { label: string };
  resolve: (value: string | boolean | null) => void;
};
type ConfirmOptions = { title: string; body?: string; confirmLabel?: string; danger?: boolean };

type Feedback = {
  toast: (text: string, tone?: Toast["tone"]) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  promptText: (options: { title: string; label: string; confirmLabel?: string }) => Promise<string | null>;
};

const SUCCESS_MS = 4000;
const ERROR_MS = 8000;

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error("useFeedback must be used inside FeedbackProvider");
  return feedback;
}

function Dialog({ request, onClose }: { request: DialogRequest; onClose: (value: string | boolean | null) => void }) {
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input, button[type=submit]")?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose(request.input ? null : false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("input, button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus?.();
    };
  }, [onClose, request.input]);

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <form
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="animate-pop w-full max-w-md rounded-xl bg-white p-5 shadow-popover"
        onSubmit={(e) => {
          e.preventDefault();
          if (request.input && !value.trim()) return;
          onClose(request.input ? value.trim() : true);
        }}
      >
        <h2 id="dialog-title" className="text-lg font-semibold text-slate-900">{request.title}</h2>
        {request.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{request.body}</p>}
        {request.input && (
          <label className="mt-3 block text-sm font-medium text-slate-700">
            {request.input.label}
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => onClose(request.input ? null : false)} className={buttonClass("secondary")}>Cancel</button>
          <button
            type="submit"
            className={request.danger ? "inline-flex items-center justify-center rounded-lg bg-rose-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-rose-800" : buttonClass("primary")}
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const value = useMemo<Feedback>(
    () => ({
      toast(text, tone = "success") {
        const id = nextId.current++;
        setToasts((current) => [...current.slice(-3), { id, tone, text }]);
        setTimeout(() => dismiss(id), tone === "error" ? ERROR_MS : SUCCESS_MS);
      },
      confirm: ({ title, body, confirmLabel = "Confirm", danger = false }) =>
        new Promise((resolve) => setDialog({ title, body, confirmLabel, danger, resolve: (v) => resolve(v === true) })),
      promptText: ({ title, label, confirmLabel = "Save" }) =>
        new Promise((resolve) =>
          setDialog({ title, confirmLabel, danger: false, input: { label }, resolve: (v) => resolve(typeof v === "string" ? v : null) })
        ),
    }),
    [dismiss]
  );

  const closeDialog = useCallback((result: string | boolean | null) => {
    setDialog((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {dialog && <Dialog request={dialog} onClose={closeDialog} />}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = toast.tone === "error" ? AlertCircle : CheckCircle2;
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className="animate-pop pointer-events-auto flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-popover"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.tone === "error" ? "text-rose-700" : "text-emerald-600"}`} strokeWidth={2} />
              <p className="min-w-0 flex-1">{toast.text}</p>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}
