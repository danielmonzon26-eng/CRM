import Link from "next/link";
import { getTasksList, type TaskFilter } from "@/lib/tasks/queries";
import { TaskList } from "@/components/task-list";
import { TaskForm } from "@/components/task-form";

export const dynamic = "force-dynamic";

const TABS: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const activeFilter = (TABS.some((t) => t.value === filter) ? filter : "open") as TaskFilter;
  const tasks = await getTasksList(activeFilter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-500">Follow-ups, calls, and to-dos across every deal.</p>
      </header>

      <div className="mb-5">
        <TaskForm />
      </div>

      <nav className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/tasks?filter=${tab.value}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeFilter === tab.value
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <TaskList tasks={tasks} showCompany />
    </main>
  );
}
