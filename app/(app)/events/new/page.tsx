import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/event-form";

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>
      <h1 className="mb-5 mt-4 text-[28px] font-semibold leading-tight tracking-tight text-slate-900">New event</h1>
      <EventForm />
    </main>
  );
}
