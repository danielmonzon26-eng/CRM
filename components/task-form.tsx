"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createTask } from "@/app/actions/tasks";
import { fromDateTimeInput } from "@/lib/events/format";
import type { TaskType } from "@/lib/supabase/types";
import { DateInput } from "@/components/ui/date-input";

export function TaskForm({
  leadId,
  companyId,
  eventId,
}: {
  leadId?: string | null;
  companyId?: string | null;
  eventId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const title = String(data.get("title") ?? "").trim();
        if (!title) return;

        startTransition(async () => {
          await createTask({
            title,
            taskType: data.get("taskType") as TaskType,
            // End of that day in Calgary, so a task isn't overdue on the day it's due.
            dueAt: data.get("dueAt") ? fromDateTimeInput(`${data.get("dueAt")}T23:59`) : null,
            leadId: leadId ?? null,
            companyId: companyId ?? null,
            eventId: eventId ?? null,
          });
          form.reset();
        });
      }}
    >
      <div className="min-w-[180px] flex-1">
        <input
          name="title"
          placeholder="New task…"
          required
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
        />
      </div>
      <select
        name="taskType"
        defaultValue="todo"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      >
        <option value="todo">To-do</option>
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
      </select>
      <DateInput
        name="dueAt"
        aria-label="Due date"
        placeholder="Due date"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Add task
      </button>
    </form>
  );
}
