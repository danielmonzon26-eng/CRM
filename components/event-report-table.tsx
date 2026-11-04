"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, DollarSign, Download, Receipt, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page";
import { formatMoney, sumMoney } from "@/lib/budgets/money";
import { downloadCsv } from "@/lib/csv";
import { EVENT_TIME_ZONE } from "@/lib/events/format";
import type { EventReportRow } from "@/lib/reports/queries";

const SELECT = "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700";
const shortDate = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
const TH = "px-3 py-2.5 text-right font-medium";
const TD = "px-3 py-2.5 text-right text-slate-700";

function Summary({ icon: Icon, tone, title, lines }: { icon: LucideIcon; tone: string; title: string; lines: [string, string][] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" strokeWidth={2} /></span>
        {title}
      </h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        {lines.map(([label, value], i) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className={i === 0 ? "text-xl font-semibold tracking-tight text-slate-900" : "font-medium text-slate-900"}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EventReportTable({ rows }: { rows: EventReportRow[] }) {
  const [program, setProgram] = useState("");
  const [timing, setTiming] = useState<"all" | "past" | "upcoming">("all");

  const programs = useMemo(() => [...new Set(rows.map((r) => r.program ?? "No program"))].sort(), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (program && (r.program ?? "No program") !== program) return false;
        if (timing === "past" && !r.isOver) return false;
        if (timing === "upcoming" && r.isOver) return false;
        return true;
      }),
    [rows, program, timing]
  );

  if (rows.length === 0) {
    return <EmptyState icon={Receipt} title="No events to report on" description="Reports fill in as you create events, take registrations, and record expenses." />;
  }

  const sum = (pick: (r: EventReportRow) => number) => sumMoney(filtered.map(pick));
  const count = (pick: (r: EventReportRow) => number) => filtered.reduce((total, r) => total + pick(r), 0);
  const registered = count((r) => r.people.registered);
  const checkedIn = count((r) => r.people.checkedIn);
  const attendedBase = filtered.filter((r) => r.isOver);
  const attendedRegistered = attendedBase.reduce((t, r) => t + r.people.registered, 0);
  const attendedChecked = attendedBase.reduce((t, r) => t + r.people.checkedIn, 0);
  const actual = sum((r) => r.costs.actual);
  const budget = sum((r) => r.costs.budget ?? 0);

  function exportCsv() {
    downloadCsv("event-report.csv", [
      ["Event", "Program", "Date", "Registered", "Capacity", "Waitlisted", "Checked in", "Attendance %", "New contacts", "Companies", "Ticket revenue (estimated)", "Other revenue", "Total revenue", "Open pipeline influenced", "Closed-won influenced", "Budget", "Committed", "Actual cost", "Remaining", "Net (revenue - actual)", "Cost per attendee"],
      ...filtered.map((r) => [
        r.title, r.program, shortDate.format(new Date(r.startsAt)),
        r.people.registered, r.people.capacity, r.people.waitlisted, r.people.checkedIn, r.people.attendancePercent, r.people.newContacts, r.people.companies,
        r.revenue.ticketsEstimated, r.revenue.other, r.revenue.total, r.revenue.openPipeline, r.revenue.closedWon,
        r.costs.budget, r.costs.committed, r.costs.actual, r.costs.remaining, r.net, r.costPerAttendee,
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Program" value={program} onChange={(e) => setProgram(e.target.value)} className={SELECT}>
          <option value="">Program: All</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Timing" value={timing} onChange={(e) => setTiming(e.target.value as typeof timing)} className={SELECT}>
          <option value="all">All events</option>
          <option value="past">Past events</option>
          <option value="upcoming">Upcoming events</option>
        </select>
        <span className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? "event" : "events"}</span>
        <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={`${buttonClass("secondary")} ml-auto`}>
          <Download className="h-4 w-4" strokeWidth={2} />
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Summary
          icon={Users}
          tone="bg-sky-50 text-sky-700"
          title="People"
          lines={[
            ["Registered", registered.toLocaleString()],
            ["Checked in", checkedIn.toLocaleString()],
            ["Attendance at past events", attendedRegistered ? `${Math.round((attendedChecked / attendedRegistered) * 100)}%` : "—"],
            ["New contacts", count((r) => r.people.newContacts).toLocaleString()],
          ]}
        />
        <Summary
          icon={DollarSign}
          tone="bg-emerald-50 text-emerald-700"
          title="Revenue"
          lines={[
            ["Total revenue", formatMoney(sum((r) => r.revenue.total))],
            ["Tickets (estimated)", formatMoney(sum((r) => r.revenue.ticketsEstimated))],
            ["Sponsors and other", formatMoney(sum((r) => r.revenue.other))],
            ["Deals won after registering", formatMoney(sum((r) => r.revenue.closedWon))],
          ]}
        />
        <Summary
          icon={Receipt}
          tone="bg-amber-50 text-amber-700"
          title="Costs"
          lines={[
            ["Actual cost", formatMoney(actual)],
            ["Budget", formatMoney(budget)],
            ["Committed", formatMoney(sum((r) => r.costs.committed))],
            ["Net (revenue minus actual)", formatMoney(sum((r) => r.net))],
          ]}
        />
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-100">
              <th scope="col" rowSpan={2} className="px-5 py-2.5 align-bottom font-medium">Event</th>
              <th scope="colgroup" colSpan={3} className="border-l border-slate-100 px-3 py-2 text-center font-semibold text-slate-700">People</th>
              <th scope="colgroup" colSpan={2} className="border-l border-slate-100 px-3 py-2 text-center font-semibold text-slate-700">Revenue</th>
              <th scope="colgroup" colSpan={3} className="border-l border-slate-100 px-3 py-2 text-center font-semibold text-slate-700">Costs</th>
              <th scope="col" rowSpan={2} className="border-l border-slate-100 px-5 py-2.5 text-right align-bottom font-medium">Net</th>
            </tr>
            <tr>
              <th scope="col" className={`border-l border-slate-100 ${TH}`}>Registered</th>
              <th scope="col" className={TH}>Attended</th>
              <th scope="col" className={TH}>New contacts</th>
              <th scope="col" className={`border-l border-slate-100 ${TH}`}>Revenue</th>
              <th scope="col" className={TH}>Deals won</th>
              <th scope="col" className={`border-l border-slate-100 ${TH}`}>Budget</th>
              <th scope="col" className={TH}>Actual</th>
              <th scope="col" className={TH}>Per attendee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-t border-slate-100">
            {filtered.map((r) => {
              const over = r.costs.remaining !== null && r.costs.remaining < 0;
              return (
                <tr key={r.eventId} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/events/${r.eventId}?tab=analytics`} className="font-medium text-slate-900 hover:text-brand-700">{r.title}</Link>
                    <span className="block text-xs text-slate-500">{[r.program, shortDate.format(new Date(r.startsAt))].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className={`border-l border-slate-100 ${TD}`}>{r.people.registered}{r.people.capacity ? ` / ${r.people.capacity}` : ""}</td>
                  <td className={TD}>{r.people.checkedIn}{r.people.attendancePercent !== null ? ` (${r.people.attendancePercent}%)` : ""}</td>
                  <td className={TD}>{r.people.newContacts}</td>
                  <td className={`border-l border-slate-100 ${TD}`}>{formatMoney(r.revenue.total)}</td>
                  <td className={TD}>{formatMoney(r.revenue.closedWon)}</td>
                  <td className={`border-l border-slate-100 ${TD}`}>{r.costs.budget === null ? "—" : formatMoney(r.costs.budget)}</td>
                  <td className={`${TD} ${over ? "font-medium text-rose-700" : ""}`}>
                    {over && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} aria-label="Over budget" />}
                    {formatMoney(r.costs.actual)}
                  </td>
                  <td className={TD}>{r.costPerAttendee === null ? "—" : formatMoney(r.costPerAttendee)}</td>
                  <td className={`border-l border-slate-100 px-5 py-2.5 text-right font-medium ${r.net < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(r.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Ticket revenue is registered seats times the ticket price, an estimate until payments are connected. Deals won counts deals on a registrant&apos;s lead created after they registered, which shows influence, not proof the event caused the sale.
      </p>
    </div>
  );
}
