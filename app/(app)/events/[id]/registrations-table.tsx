"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, Search } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { FORMAT_LABELS } from "@/lib/events/format";
import type { EventRegistrationRow } from "@/lib/events/queries";
import { RegistrationActions } from "./event-controls";

const STATUS_FILTERS = [
  ["all", "All"],
  ["registered", "Registered"],
  ["checked_in", "Checked in"],
  ["waitlisted", "Waitlist"],
  ["cancelled", "Cancelled"],
] as const;

function statusLabel(r: EventRegistrationRow): string {
  if (r.status === "cancelled") return "Cancelled";
  if (r.status === "waitlisted") return "Waitlist";
  return r.checked_in_at ? "Checked in" : "Registered";
}

export function RegistrationsTable({
  registrations,
  eventId,
  fileName,
}: {
  registrations: EventRegistrationRow[];
  eventId: string;
  fileName: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number][0]>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (status === "checked_in" && !(r.status === "registered" && r.checked_in_at)) return false;
      if (status !== "all" && status !== "checked_in" && r.status !== status) return false;
      return !query || [r.full_name, r.email, r.company_name].some((v) => v?.toLowerCase().includes(query));
    });
  }, [registrations, search, status]);

  function exportCsv() {
    downloadCsv(fileName, [
      ["Name", "Email", "Phone", "Company", "Attending", "Status", "Registered"],
      ...filtered.map((r) => [r.full_name, r.email, r.phone, r.company_name, FORMAT_LABELS[r.attendance_mode], statusLabel(r), r.created_at]),
    ]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            aria-label="Search registrations"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700"
        >
          {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={buttonClass("secondary")}>
          <Download className="h-4 w-4" strokeWidth={2} />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {registrations.length === 0 ? "No registrations yet. Share the landing page link to get started." : "No registrations match."}
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-3 py-3 font-medium">Email</th>
                <th scope="col" className="px-3 py-3 font-medium">Company</th>
                <th scope="col" className="px-3 py-3 font-medium">Attending</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 font-medium">Registered</th>
                <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className={r.status === "cancelled" ? "text-slate-500" : "text-slate-700"}>
                  <td className="px-4 py-2.5 font-medium">
                    {r.lead_id ? (
                      <Link href={`/leads/${r.lead_id}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                        {r.full_name}
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                      </Link>
                    ) : (
                      r.full_name
                    )}
                  </td>
                  <td className="px-3 py-2.5">{r.email}</td>
                  <td className="px-3 py-2.5">{r.company_name ?? "—"}</td>
                  <td className="px-3 py-2.5">{FORMAT_LABELS[r.attendance_mode]}</td>
                  <td className="px-3 py-2.5">{statusLabel(r)}</td>
                  <td className="px-3 py-2.5 text-xs">{new Date(r.created_at).toLocaleDateString("en-CA")}</td>
                  <td className="px-3 py-2.5">
                    <RegistrationActions registrationId={r.id} eventId={eventId} status={r.status} checkedIn={Boolean(r.checked_in_at)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
