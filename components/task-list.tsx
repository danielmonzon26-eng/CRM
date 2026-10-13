"use client";

import { useTransition } from "react";
import { completeTask, reopenTask, deleteTask } from "@/app/actions/tasks";
import type { TaskListRow } from "@/lib/tasks/queries";

const TYPE_LABEL: Record<string, string> = {
  todo: "To-do",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
};

function isOverdue(task: TaskListRow): boolean {
  return !task.completedAt && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
}

export function TaskList({ tasks, showCompany = false }: { tasks: TaskListRow[]; showCompany?: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">No tasks.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const overdue = isOverdue(task);
        return (
          <li
            key={task.id}
            className={`flex items-start gap-3 rounded-md border bg-white p-3 ${
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
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${task.completedAt ? "text-slate-400 line-through" : "text-slate-900"}`}>
                {task.title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5">{TYPE_LABEL[task.taskType] ?? task.taskType}</span>
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
              className="shrink-0 text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
