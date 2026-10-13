"use client";

import { useRef, useTransition } from "react";
import { createTask } from "@/app/actions/tasks";
import type { TaskType } from "@/lib/supabase/types";

export function TaskForm({ leadId, companyId }: { leadId?: string | null; companyId?: string | null }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
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
            dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))).toISOString() : null,
            leadId: leadId ?? null,
            companyId: companyId ?? null,
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
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        />
      </div>
      <select name="taskType" defaultValue="todo" className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
        <option value="todo">To-do</option>
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
      </select>
      <input type="date" name="dueAt" className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Add task
      </button>
    </form>
  );
}
