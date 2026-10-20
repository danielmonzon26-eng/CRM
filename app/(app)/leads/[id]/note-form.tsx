"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { addLeadNote } from "@/app/actions/leads";

export function NoteForm({ leadId }: { leadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const body = String(formData.get("body") ?? "");
        startTransition(async () => {
          await addLeadNote(leadId, body);
          formRef.current?.reset();
        });
      }}
      className="flex gap-2"
    >
      <textarea
        name="body"
        required
        rows={2}
        placeholder="Log a note on this deal…"
        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
      <button
        type="submit"
        disabled={isPending}
        className="flex h-fit shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" strokeWidth={2} />
        Log
      </button>
    </form>
  );
}
