"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database, NoteKind } from "@/lib/supabase/types";

const KINDS: NoteKind[] = ["note", "call", "meeting", "email"];
const MAX_BODY = 20_000;

type ActionResult = { error?: string };

function revalidateLead(leadId: string, companyId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/companies/${companyId}`);
}

function checkOccurredAt(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // A little slack for clocks; notes can't be dated more than a day ahead.
  if (date.getTime() > Date.now() + 86_400_000) return null;
  return date.toISOString();
}

export type NoteInput = { kind: NoteKind; body: string; occurredAt?: string; contactId?: string | null };

export async function addNote(leadId: string, input: NoteInput): Promise<ActionResult> {
  const body = input.body.trim();
  if (!body) return { error: "Write something first." };
  if (body.length > MAX_BODY) return { error: "That note is too long." };
  if (!KINDS.includes(input.kind)) return { error: "Choose a note type." };
  const occurredAt = checkOccurredAt(input.occurredAt);
  if (occurredAt === null) return { error: "Check the date and time." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const { data: lead } = await supabase.from("leads").select("company_id").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "That lead wasn't found." };

  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    company_id: lead.company_id,
    contact_id: input.contactId || null,
    kind: input.kind,
    body,
    ...(occurredAt ? { occurred_at: occurredAt } : {}),
    created_by: user.id,
  });
  if (error) return { error: "The note wasn't saved. Please try again." };

  revalidateLead(leadId, lead.company_id);
  return {};
}

export async function updateNote(noteId: string, input: Partial<NoteInput>): Promise<ActionResult> {
  const update: Database["public"]["Tables"]["lead_notes"]["Update"] = {};
  if (input.body !== undefined) {
    const body = input.body.trim();
    if (!body) return { error: "A note can't be empty. Delete it instead." };
    if (body.length > MAX_BODY) return { error: "That note is too long." };
    update.body = body;
  }
  if (input.kind !== undefined) {
    if (!KINDS.includes(input.kind)) return { error: "Choose a note type." };
    update.kind = input.kind;
  }
  if (input.occurredAt !== undefined) {
    const occurredAt = checkOccurredAt(input.occurredAt);
    if (!occurredAt) return { error: "Check the date and time." };
    update.occurred_at = occurredAt;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  update.updated_by = user?.id ?? null;

  const { data, error } = await supabase.from("lead_notes").update(update).eq("id", noteId).select("lead_id, company_id").single();
  if (error || !data) return { error: "The note wasn't saved. Please try again." };
  revalidateLead(data.lead_id, data.company_id);
  return {};
}

export async function setNotePinned(noteId: string, pinned: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_notes").update({ pinned }).eq("id", noteId).select("lead_id, company_id").single();
  if (error || !data) return { error: "That didn't save. Please try again." };
  revalidateLead(data.lead_id, data.company_id);
  return {};
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_notes").delete().eq("id", noteId).select("lead_id, company_id").single();
  if (error || !data) return { error: "The note wasn't deleted. Please try again." };
  revalidateLead(data.lead_id, data.company_id);
  return {};
}
