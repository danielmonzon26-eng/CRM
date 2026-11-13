import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDiscoveryCall } from "@/lib/discovery/queries";
import { DiscoveryForm } from "./discovery-form";

export const dynamic = "force-dynamic";

export default async function DiscoveryCallPage({ params }: { params: Promise<{ id: string; callId: string }> }) {
  const { id, callId } = await params;
  const call = await getDiscoveryCall(callId);
  if (!call || call.leadId !== id) notFound();

  const supabase = await createClient();
  const [{ data: company }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", call.companyId).maybeSingle(),
    supabase.from("contacts").select("id, full_name").eq("lead_id", id).order("is_primary", { ascending: false }).order("full_name"),
  ]);
  const companyName = company?.name ?? "Unknown company";

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/leads/${id}#discovery`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to {companyName}
      </Link>
      <header className="mb-5 mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Internal: do not send to the prospect</p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-[2.125rem] text-slate-900">Discovery call</h1>
        <p className="text-sm text-slate-500">{companyName}</p>
      </header>
      <DiscoveryForm call={call} companyName={companyName} contacts={(contacts ?? []).map((c) => ({ id: c.id, name: c.full_name }))} />
    </main>
  );
}
