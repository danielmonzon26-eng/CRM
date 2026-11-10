import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen } from "@/lib/events/format";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Event feedback", robots: { index: false } };

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_feedback_form", { p_token: token });
  if (error) throw error;
  const form = data?.[0];
  if (!form) notFound();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-popover">
        <div className="h-1.5 bg-brand-600" />
        <header className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Catapult · Feedback</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-900">{form.event_title}</h1>
          <p className="mt-1 text-sm text-slate-600">{formatEventWhen(form.starts_at, null)}</p>
        </header>
        {form.submitted ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-600" strokeWidth={1.75} />
            <p className="mt-3 text-lg font-semibold text-slate-900">Thanks, we have your feedback.</p>
            <p className="mt-1 text-sm text-slate-600">It helps us plan better events. You can close this page.</p>
          </div>
        ) : (
          <FeedbackForm token={token} firstName={form.first_name} />
        )}
      </div>
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-slate-500">Your answers go to the Catapult team only.</p>
    </main>
  );
}
