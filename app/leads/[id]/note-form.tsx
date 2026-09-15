"use client";

import { useRef, useTransition } from "react";
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
        placeholder="Add a note..."
        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
