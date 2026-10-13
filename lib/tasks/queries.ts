import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { TaskType } from "@/lib/supabase/types";

export type TaskListRow = {
  id: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  dueAt: string | null;
  completedAt: string | null;
  leadId: string | null;
  companyId: string | null;
  companyName: string | null;
};

export type TaskFilter = "open" | "overdue" | "completed" | "all";

export async function getTasksList(filter: TaskFilter = "open"): Promise<TaskListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id, title, description, task_type, due_at, completed_at, lead_id, company_id")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (filter === "open") query = query.is("completed_at", null);
  if (filter === "completed") query = query.not("completed_at", "is", null);
  if (filter === "overdue") query = query.is("completed_at", null).lt("due_at", new Date().toISOString());

  const tasks = await fetchAllPages((from, to) => query.range(from, to));
  if (tasks.length === 0) return [];

  const leadIds = [...new Set(tasks.map((t) => t.lead_id).filter((id): id is string => id !== null))];
  const leads =
    leadIds.length > 0
      ? await fetchAllPages((from, to) => supabase.from("leads").select("id, company_id").in("id", leadIds).range(from, to))
      : [];
  const companyIdByLead = new Map(leads.map((l) => [l.id, l.company_id]));

  const directCompanyIds = tasks.map((t) => t.company_id).filter((id): id is string => id !== null);
  const companyIds = [...new Set([...leads.map((l) => l.company_id), ...directCompanyIds])];
  const { data: companies, error } =
    companyIds.length > 0
      ? await supabase.from("companies").select("id, name").in("id", companyIds)
      : { data: [], error: null };
  if (error) throw error;
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  return tasks.map((t) => {
    const companyId = t.company_id ?? (t.lead_id ? companyIdByLead.get(t.lead_id) ?? null : null);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      taskType: t.task_type,
      dueAt: t.due_at,
      completedAt: t.completed_at,
      leadId: t.lead_id,
      companyId,
      companyName: companyId ? companyNameById.get(companyId) ?? null : null,
    };
  });
}

export async function getOpenTaskCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("completed_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function getTasksForSubject(opts: { leadId?: string; companyId?: string }): Promise<TaskListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, description, task_type, due_at, completed_at, lead_id, company_id")
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (opts.leadId) query = query.eq("lead_id", opts.leadId);
  else if (opts.companyId) query = query.eq("company_id", opts.companyId);
  else return [];

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    taskType: t.task_type,
    dueAt: t.due_at,
    completedAt: t.completed_at,
    leadId: t.lead_id,
    companyId: t.company_id,
    companyName: null,
  }));
}
