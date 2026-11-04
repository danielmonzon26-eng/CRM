"use server";

import { createClient } from "@/lib/supabase/server";

export type RegisterInput = {
  slug: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  attendanceMode: string | null;
  website: string;
};

export type RegisterResult = {
  status: "registered" | "waitlisted" | "already_registered" | "sold_out" | "closed" | "not_open" | "not_found" | "invalid" | "error";
  ticketCode?: string;
  onlineUrl?: string | null;
  confirmationMessage?: string | null;
};

export async function registerForEvent(input: RegisterInput): Promise<RegisterResult> {
  // `website` is a hidden field people never see, so anything in it came from a bot.
  // It gets the normal success screen and nothing is saved.
  if (input.website) return { status: "registered" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_event", {
    p_slug: input.slug,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
    p_company: input.company,
    p_attendance_mode: input.attendanceMode,
  });
  if (error) {
    console.error("register_for_event failed", error.message);
    return { status: "error" };
  }

  return {
    status: data.status,
    ticketCode: data.ticket_code,
    onlineUrl: data.online_url,
    confirmationMessage: data.confirmation_message,
  };
}
