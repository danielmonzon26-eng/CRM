"use client";

import { useTransition } from "react";
import { Phone, Mail, CheckSquare, Users as UsersIcon, X } from "lucide-react";
import { completeTask, reopenTask, deleteTask } from "@/app/actions/tasks";
import type { TaskListRow } from "@/lib/tasks/queries";

const TYPE_META: Record<string, { label: string; icon: typeof CheckSquare }> = {
  todo: { label: "To-do", icon: CheckSquare },
  call: { label: "Call", icon: Phone },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: UsersIcon },
};

function isOverdue(task: TaskListRow): boolean {
  return !task.completedAt && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
}

export function TaskList({ tasks, showCompany = false }: { tasks: TaskListRow[]; showCompany?: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
        No tasks.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const overdue = isOverdue(task);
        const meta = TYPE_META[task.taskType] ?? TYPE_META.todo;
        const Icon = meta.icon;
        return (
          <li
            key={task.id}
            className={`flex items-start gap-3 rounded-lg border bg-white p-3 shadow-card ${
              overdue ? "border-rose-200" : "border-slate-200"
            }`}
          >
            <input
              type="checkbox"
              checked={!!task.completedAt}
              disabled={isPending}
              onChange={() =>
                startTransition(() =>
                  task.completedAt ? reopenTask(task.id, task.leadId) : completeTask(task.id, task.leadId)
                )
              }
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${task.completedAt ? "text-slate-400 line-through" : "text-slate-900"}`}>
                {task.title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                  <Icon className="h-3 w-3" strokeWidth={2} />
                  {meta.label}
                </span>
                {task.dueAt && (
                  <span className={overdue ? "font-medium text-rose-600" : ""}>
                    Due {new Date(task.dueAt).toLocaleDateString()}
                  </span>
                )}
                {showCompany && task.companyName && <span>· {task.companyName}</span>}
              </div>
              {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => deleteTask(task.id, task.leadId, task.companyId))}
              title="Remove"
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
