import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTasksList, type TaskFilter } from "@/lib/tasks/queries";
import { getMarketingItems } from "@/lib/marketing/items-queries";
import { getTeamMembers } from "@/lib/leads/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { MARKETING_CATEGORY_LABELS, MARKETING_CATEGORY_STYLES, MARKETING_STATUS_STYLES, MARKETING_STATUSES } from "@/lib/budgets/marketing-items";
import { calgaryDateKey } from "@/lib/events/format";
import { TaskList } from "@/components/task-list";
import { TaskForm } from "@/components/task-form";

export const dynamic = "force-dynamic";

const TABS: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const money = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const FIELD =
  "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

/**
 * Assignments: everything assigned to people, tasks and marketing items together. Pick a
 * person (or yourself) and search to see what they've been given.
 */
export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ filter?: string; person?: string; q?: string }> }) {
  const { filter, person: personParam, q = "" } = await searchParams;
  const activeFilter = (TABS.some((t) => t.value === filter) ? filter : "open") as TaskFilter;
  const [user, team] = await Promise.all([getCurrentUser(), getTeamMembers()]);
  const members = team
    .map((m) => ({ id: m.id, name: m.fullName?.trim() || m.email || "Team member" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const memberNames = Object.fromEntries(members.map((m) => [m.id, m.name]));
  // No choice means everyone; "me" is the person signed in.
  const person = personParam === "me" ? (user?.id ?? "") : (personParam ?? "");
  const assigneeId = person === "unassigned" ? "unassigned" : members.some((m) => m.id === person) ? person : undefined;

  const [tasks, allItems] = await Promise.all([
    getTasksList(activeFilter, { assigneeId, search: q }),
    getMarketingItems({ assigneeId }).catch(() => []),
  ]);
  const today = calgaryDateKey(new Date());
  const query = q.trim().toLowerCase();
  const items = allItems.filter((i) => {
    if (activeFilter === "completed" && i.status !== "done") return false;
    if ((activeFilter === "open" || activeFilter === "overdue") && i.status === "done") return false;
    if (activeFilter === "overdue" && !(i.due && i.due < today)) return false;
    if (query && ![i.name, i.description, i.event?.title, i.sponsor?.name].some((v) => v?.toLowerCase().includes(query))) return false;
    return true;
  });
  const who = assigneeId === "unassigned" ? "Unassigned" : assigneeId ? memberNames[assigneeId] : "Everyone";
  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ filter: activeFilter, ...(personParam ? { person: personParam } : {}), ...(q ? { q } : {}), ...patch });
    return `/tasks?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-[2.125rem] text-slate-900">Assignments</h1>
        <p className="text-sm text-slate-500">Tasks and marketing items, and who they&apos;re assigned to. Pick a person to see everything they&apos;ve been given.</p>
      </header>

      <form method="get" action="/tasks" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <input type="hidden" name="filter" value={activeFilter} />
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Person
          <select name="person" defaultValue={personParam ?? ""} className={`${FIELD} mt-1 block w-56 font-normal normal-case tracking-normal`}>
            <option value="">Everyone</option>
            {user && <option value="me">Me</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        <label className="min-w-56 flex-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Search
          <input name="q" defaultValue={q} placeholder="Search assignments, events or sponsors..." className={`${FIELD} mt-1 block w-full font-normal normal-case tracking-normal`} />
        </label>
        <button type="submit" className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          Show
        </button>
        {(personParam || q) && (
          <Link href={`/tasks?filter=${activeFilter}`} className="h-9 px-2 text-sm leading-9 text-slate-600 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <nav className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={link({ filter: tab.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeFilter === tab.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p className="mb-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{who}</span> · {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {items.length} marketing{" "}
        {items.length === 1 ? "item" : "items"}
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="tasks-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
          <h2 id="tasks-title" className="rounded-t-xl border-b border-slate-200/70 bg-slate-50/80 px-5 py-4 text-lg font-semibold text-slate-900">
            Tasks
          </h2>
          <div className="space-y-4 p-5">
            <TaskForm members={members} />
            <TaskList tasks={tasks} showCompany memberNames={memberNames} />
          </div>
        </section>

        <section aria-labelledby="items-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200/70 bg-slate-50/80 px-5 py-4">
            <h2 id="items-title" className="text-lg font-semibold text-slate-900">
              Marketing items
            </h2>
            <Link href="/marketing/planner?view=table" className="text-sm font-medium text-brand-700 hover:underline">
              Open the planner
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No marketing items here. Assign them in the Marketing planner.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((i) => {
                const late = i.status !== "done" && !!i.due && i.due < today;
                return (
                  <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs ${MARKETING_CATEGORY_STYLES[i.type] ?? "bg-slate-100"}`}>{MARKETING_CATEGORY_LABELS[i.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                      <p className={`text-xs ${late ? "text-rose-700" : "text-slate-500"}`}>
                        {[i.event?.title ?? i.sponsor?.name ?? "Catapult", i.due ? `${late ? "Overdue · " : "Due "}${dayFmt.format(new Date(`${i.due}T00:00:00Z`))}` : null, i.amount ? money(i.amount) : null]
                          .filter(Boolean)
                          .join(" · ")}
                        {!assigneeId && <span className="font-medium text-slate-700"> · {i.assigneeId ? (memberNames[i.assigneeId] ?? "Team member") : "Unassigned"}</span>}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${MARKETING_STATUS_STYLES[i.status]}`}>
                      {MARKETING_STATUSES.find(([k]) => k === i.status)?.[1]}
                    </span>
                    {i.event && (
                      <Link href={`/events/${i.event.id}?tab=budget`} aria-label={`Open ${i.event.title}`} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700">
                        <ExternalLink className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
