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
  eventId: string | null;
  eventTitle: string | null;
  assignedTo: string | null;
};

export type TaskFilter = "open" | "overdue" | "completed" | "all";

export async function getTasksList(filter: TaskFilter = "open", options: { assigneeId?: string | "unassigned"; search?: string } = {}): Promise<TaskListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id, title, description, task_type, due_at, completed_at, lead_id, company_id, event_id, assigned_to")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (options.assigneeId === "unassigned") query = query.is("assigned_to", null);
  else if (options.assigneeId) query = query.eq("assigned_to", options.assigneeId);
  const search = options.search?.trim().replace(/[%_\\,()]/g, " ").trim();
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

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

  const eventIds = [...new Set(tasks.map((t) => t.event_id).filter((id): id is string => id !== null))];
  const { data: events, error: eventsError } =
    eventIds.length > 0 ? await supabase.from("events").select("id, title").in("id", eventIds) : { data: [], error: null };
  if (eventsError) throw eventsError;
  const eventTitleById = new Map((events ?? []).map((e) => [e.id, e.title]));

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
      eventId: t.event_id,
      eventTitle: t.event_id ? eventTitleById.get(t.event_id) ?? null : null,
      assignedTo: t.assigned_to,
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

export async function getTasksForSubject(opts: {
  leadId?: string;
  companyId?: string;
  eventId?: string;
}): Promise<TaskListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, description, task_type, due_at, completed_at, lead_id, company_id, event_id, assigned_to")
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (opts.leadId) query = query.eq("lead_id", opts.leadId);
  else if (opts.companyId) query = query.eq("company_id", opts.companyId);
  else if (opts.eventId) query = query.eq("event_id", opts.eventId);
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
    eventId: t.event_id,
    eventTitle: null,
    assignedTo: t.assigned_to,
  }));
}
