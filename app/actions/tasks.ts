"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskType } from "@/lib/supabase/types";

export async function createTask(input: {
  title: string;
  description?: string;
  taskType: TaskType;
  dueAt?: string | null;
  leadId?: string | null;
  companyId?: string | null;
}) {
  const title = input.title.trim();
  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    title,
    description: input.description?.trim() || null,
    task_type: input.taskType,
    due_at: input.dueAt || null,
    lead_id: input.leadId ?? null,
    company_id: input.leadId ? null : input.companyId ?? null,
    created_by: user?.id ?? null,
    assigned_to: user?.id ?? null,
  });
  if (error) throw error;

  revalidatePath("/tasks");
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.companyId) revalidatePath(`/companies/${input.companyId}`);
}

export async function completeTask(taskId: string, leadId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: task, error } = await supabase
    .from("tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("title, lead_id, company_id")
    .single();
  if (error) throw error;

  if (task.lead_id) {
    await supabase.from("activities").insert({
      lead_id: task.lead_id,
      actor_id: user?.id ?? null,
      type: "task_completed",
      body: `Completed task: ${task.title}`,
    });
  }

  revalidatePath("/tasks");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (task.company_id) revalidatePath(`/companies/${task.company_id}`);
}

export async function reopenTask(taskId: string, leadId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ completed_at: null }).eq("id", taskId);
  if (error) throw error;

  revalidatePath("/tasks");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function deleteTask(taskId: string, leadId: string | null, companyId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;

  revalidatePath("/tasks");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}
