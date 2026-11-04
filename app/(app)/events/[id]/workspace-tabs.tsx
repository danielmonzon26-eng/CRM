import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ExternalLink,
  Mail,
  MonitorPlay,
  Pencil,
  Target,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { DeleteRevenueButton, EventLinePicker, RevenueForm } from "@/components/budget-controls";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page";
import { EVENT_TIME_ZONE, FORMAT_LABELS, calgaryDateKey, formatEventWhen, formatTicketPrice, getVideoEmbedUrl } from "@/lib/events/format";
import { formatMoney } from "@/lib/budgets/money";
import type { LineDetail, LineSummary } from "@/lib/budgets/queries";
import type { EventDetail, EventRevenueEntry } from "@/lib/events/queries";
import type { EventReportRow } from "@/lib/reports/queries";
import type { TaskListRow } from "@/lib/tasks/queries";
import { CopyButton, DocumentRow, DocumentUpload, RemoveResourceButton, VideoForm } from "./event-controls";
import { RegistrationsTable } from "./registrations-table";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";
const shortDate = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, month: "short", day: "numeric" });

const money = formatMoney;

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function getCounts(detail: EventDetail, tasks: TaskListRow[]) {
  const registered = detail.registrations.filter((r) => r.status === "registered");
  return {
    registered,
    checkedIn: registered.filter((r) => r.checked_in_at).length,
    online: registered.filter((r) => r.attendance_mode === "online").length,
    waitlisted: detail.registrations.filter((r) => r.status === "waitlisted").length,
    tasksDone: tasks.filter((t) => t.completedAt).length,
    tasksOpen: tasks.filter((t) => !t.completedAt).length,
  };
}

function Metric({ icon: Icon, tone, value, label, detail }: { icon: LucideIcon; tone: string; value: string; label: string; detail: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

type Milestone = { key: string; title: string; at: string; done: boolean; href?: string };

function buildTimeline(detail: EventDetail, tasks: TaskListRow[]): Milestone[] {
  const { event } = detail;
  const now = Date.now();
  const past = (iso: string) => new Date(iso).getTime() < now;
  const items: Milestone[] = [];
  if (event.registration_opens_at) items.push({ key: "opens", title: "Registration opens", at: event.registration_opens_at, done: past(event.registration_opens_at) });
  if (event.registration_closes_at) items.push({ key: "closes", title: "Registration closes", at: event.registration_closes_at, done: past(event.registration_closes_at) });
  items.push({ key: "event", title: "Event day", at: event.starts_at, done: past(event.ends_at ?? event.starts_at) });
  for (const task of tasks) {
    if (task.dueAt) items.push({ key: task.id, title: task.title, at: task.dueAt, done: Boolean(task.completedAt) });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export function OverviewTab({
  detail,
  tasks,
  landingUrl,
  line,
}: {
  detail: EventDetail;
  tasks: TaskListRow[];
  landingUrl: string;
  line: LineSummary | null;
}) {
  const { event } = detail;
  const counts = getCounts(detail, tasks);
  const fill = event.capacity ? percent(counts.registered.length, event.capacity) : null;
  const attendance = percent(counts.checkedIn, counts.registered.length);
  const readiness = percent(counts.tasksDone, tasks.length);
  const timeline = buildTimeline(detail, tasks);
  const base = `/events/${event.id}`;

  return (
    <div className="space-y-5">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={Users}
          tone="bg-brand-50 text-brand-600"
          value={event.capacity ? `${counts.registered.length} / ${event.capacity}` : String(counts.registered.length)}
          label="Registrations"
          detail={[fill !== null ? `${fill}% of capacity` : "No capacity limit", counts.waitlisted ? `${counts.waitlisted} on waitlist` : ""].filter(Boolean).join(" · ")}
        />
        <Metric
          icon={ClipboardCheck}
          tone="bg-sky-50 text-sky-700"
          value={String(counts.checkedIn)}
          label="Checked in"
          detail={attendance !== null ? `${attendance}% of registered` : "No registrations yet"}
        />
        <Metric
          icon={Wallet}
          tone="bg-emerald-50 text-emerald-700"
          value={line ? money(line.amount) : event.budget_amount != null ? money(event.budget_amount) : "—"}
          label="Budget"
          detail={line ? `${money(line.actual)} spent · ${line.percentUsed}% used` : "Not linked to a budget line"}
        />
        <Metric
          icon={Target}
          tone="bg-amber-50 text-amber-700"
          value={readiness !== null ? `${readiness}%` : "—"}
          label="Readiness"
          detail={tasks.length ? `${counts.tasksDone} of ${tasks.length} tasks done` : "Add tasks to track this"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={CARD}>
          <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Event timeline</h2>
          <ol className="divide-y divide-slate-100">
            {timeline.map((item) => {
              const Icon = item.done ? CheckCircle2 : Circle;
              return (
                <li key={item.key} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${item.done ? "text-emerald-600" : "text-slate-400"}`} strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate text-slate-800">{item.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{shortDate.format(new Date(item.at))}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-5">
          <section className={CARD}>
            <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Quick actions</h2>
            <ul className="p-2 text-sm">
              {([
                [Users, "View registration list", `${base}?tab=registrations`],
                [Mail, "Send communication", `${base}?tab=communications`],
                [ClipboardCheck, "Check-in / attendance", `${base}?tab=registrations`],
                [Pencil, "Edit event details", `${base}/edit`],
              ] as [LucideIcon, string, string][]).map(([Icon, label, href]) => (
                <li key={label}>
                  <Link href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50">
                    <Icon className="h-4 w-4 text-slate-500" strokeWidth={2} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} p-5 text-sm`}>
            <h2 className="font-semibold text-slate-900">Landing page</h2>
            {event.status === "published" ? (
              <>
                <p className="mt-1 break-all text-xs text-slate-500">{landingUrl}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton text={landingUrl} />
                  <a href={`/register/${event.slug}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    Open
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-slate-500">
                  {event.status === "draft" ? "Only your team can see this while it's a draft. Publish to share it." : "This event is cancelled."}
                </p>
                <a href={`/register/${event.slug}`} target="_blank" rel="noreferrer" className={`${buttonClass("secondary", "sm")} mt-3`}>
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  Preview
                </a>
              </>
            )}
          </section>

          <section className={`${CARD} p-5 text-sm`}>
            <h2 className="font-semibold text-slate-900">Details</h2>
            <dl className="mt-2 space-y-2">
              <Detail label="When" value={formatEventWhen(event.starts_at, event.ends_at)} />
              <Detail label="Format" value={FORMAT_LABELS[event.format]} />
              {event.format !== "online" && <Detail label="Venue" value={[event.venue_name, event.venue_address].filter(Boolean).join(", ") || "Not set"} />}
              {event.format !== "in_person" && (
                <div>
                  <dt className="text-xs text-slate-500">Livestream or join link</dt>
                  <dd className="break-all">
                    {event.online_url ? (
                      <a href={event.online_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{event.online_url}</a>
                    ) : "Not set"}
                  </dd>
                </div>
              )}
              <Detail label="Tickets" value={formatTicketPrice(event.ticket_type, event.ticket_price, event.currency)} />
            </dl>
          </section>
        </div>
      </div>

      {event.description && (
        <section className={`${CARD} p-5 text-sm`}>
          <h2 className="font-semibold text-slate-900">Description</h2>
          <p className="mt-1 whitespace-pre-line text-slate-600">{event.description}</p>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

export function RegistrationsTab({ detail }: { detail: EventDetail }) {
  return (
    <RegistrationsTable
      registrations={detail.registrations}
      eventId={detail.event.id}
      fileName={`${detail.event.slug}-registrations.csv`}
    />
  );
}

function EditLink({ eventId, step, label }: { eventId: string; step: number; label: string }) {
  return (
    <Link href={`/events/${eventId}/edit?step=${step}`} className={buttonClass("secondary")}>
      <Pencil className="h-4 w-4" strokeWidth={2} />
      {label}
    </Link>
  );
}

export function AgendaTab({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const action = <EditLink eventId={event.id} step={1} label="Edit agenda" />;
  if (event.agenda.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="No agenda yet" description="Add sessions and they'll appear here and on the landing page." action={action} />;
  }
  return (
    <div>
      <div className="mb-3 flex justify-end">{action}</div>
      <ol className={`${CARD} divide-y divide-slate-100`}>
        {event.agenda.map((item, i) => (
          <li key={i} className="flex gap-4 px-5 py-3 text-sm">
            <span className="w-28 shrink-0 text-slate-500">{item.time || "—"}</span>
            <span className="font-medium text-slate-900">{item.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SpeakersTab({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const action = <EditLink eventId={event.id} step={1} label="Edit speakers" />;
  if (event.speakers.length === 0) {
    return <EmptyState icon={Users} title="No speakers yet" description="Add speakers and they'll appear here and on the landing page." action={action} />;
  }
  return (
    <div>
      <div className="mb-3 flex justify-end">{action}</div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {event.speakers.map((speaker, i) => (
          <li key={i} className={`${CARD} p-4 text-sm`}>
            <p className="font-medium text-slate-900">{speaker.name}</p>
            {speaker.title && <p className="mt-0.5 text-slate-500">{speaker.title}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BudgetTab({
  detail,
  line,
  unlinkedLines,
  revenue,
  report,
}: {
  detail: EventDetail;
  line: LineDetail | null;
  unlinkedLines: { id: string; name: string; amount: number }[];
  revenue: EventRevenueEntry[];
  report: EventReportRow | null;
}) {
  const { event } = detail;
  const ticketEstimate = report?.revenue.ticketsEstimated ?? 0;

  return (
    <div className="space-y-5">
      {line ? (
        <>
          <section aria-label="Budget figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ["Budget", line.line.amount],
              ["Committed", line.line.committed],
              ["Actual", line.line.actual],
              ["Remaining", line.line.remaining],
            ] as [string, number][]).map(([label, value]) => (
              <div key={label} className={`${CARD} p-4`}>
                <p className={`text-2xl font-semibold tracking-tight ${label === "Remaining" && value < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(value)}</p>
                <p className="text-sm text-slate-600">{label}</p>
              </div>
            ))}
          </section>
          <section className={CARD}>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="font-semibold text-slate-900">{line.line.name}</h2>
                <p className="text-xs text-slate-500">{line.budgetName}</p>
              </div>
              <Link href={`/budgets/lines/${line.line.id}`} className={buttonClass("secondary", "sm")}>Add expenses</Link>
            </header>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Budget</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Actual</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {line.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2.5 text-slate-800">{item.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(item.amount)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(item.actual)}</td>
                      <td className={`px-5 py-2.5 text-right font-medium ${item.remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(item.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className={`${CARD} p-5`}>
          <h2 className="font-semibold text-slate-900">Budget</h2>
          {unlinkedLines.length > 0 ? (
            <>
              <p className="mb-3 mt-1 text-sm text-slate-500">Tie this event to its line in the approved budget to track spending against it.</p>
              <EventLinePicker eventId={event.id} lines={unlinkedLines} />
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              {event.budget_amount != null ? `${formatMoney(event.budget_amount)} allocated. ` : ""}
              No unlinked event lines are available. <Link href="/budgets" className="font-medium text-brand-600 hover:underline">Go to Budgets</Link>
            </p>
          )}
        </section>
      )}

      <section className={CARD}>
        <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Revenue</h2>
        <div className="space-y-4 p-5">
          <RevenueForm eventId={event.id} />
          <ul className="divide-y divide-slate-100 text-sm">
            {event.ticket_type === "paid" && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-700">Tickets (estimated: registered seats times the price)</span>
                <span className="font-medium text-slate-900">{formatMoney(ticketEstimate)}</span>
              </li>
            )}
            {revenue.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 text-slate-700">{r.source}{r.received_on ? ` · ${r.received_on}` : ""}</span>
                <span className="flex shrink-0 items-center gap-1 font-medium text-slate-900">
                  {formatMoney(r.amount)}
                  <DeleteRevenueButton revenueId={r.id} label={`${r.source}, ${formatMoney(r.amount)}`} />
                </span>
              </li>
            ))}
            {event.ticket_type !== "paid" && revenue.length === 0 && <li className="py-2 text-slate-500">No revenue recorded yet.</li>}
          </ul>
        </div>
      </section>

      {(event.funding_source || event.budget_notes) && (
        <section className={`${CARD} p-5 text-sm`}>
          <h2 className="font-semibold text-slate-900">Planning notes</h2>
          {event.funding_source && <p className="mt-1 text-slate-700">Funding source: {event.funding_source}</p>}
          {event.budget_notes && <p className="mt-1 whitespace-pre-line text-slate-600">{event.budget_notes}</p>}
        </section>
      )}
    </div>
  );
}

export function TasksTab({ eventId, tasks }: { eventId: string; tasks: TaskListRow[] }) {
  return (
    <div className="space-y-3">
      <TaskForm eventId={eventId} />
      <TaskList tasks={tasks} />
    </div>
  );
}

export function CommunicationsTab({ detail }: { detail: EventDetail }) {
  const { registrations, event } = detail;
  const registered = registrations.filter((r) => r.status === "registered");
  const waitlisted = registrations.filter((r) => r.status === "waitlisted");
  const groups: [string, string[]][] = [
    ["Everyone registered", registered.map((r) => r.email)],
    ["Attending in person", registered.filter((r) => r.attendance_mode === "in_person").map((r) => r.email)],
    ["Attending online", registered.filter((r) => r.attendance_mode === "online").map((r) => r.email)],
    ["Not checked in", registered.filter((r) => !r.checked_in_at).map((r) => r.email)],
    ["Waitlist", waitlisted.map((r) => r.email)],
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Sending from the CRM isn&apos;t connected yet, so nothing here emails anyone. Copy a list into your email app, using BCC to keep addresses private.
      </p>
      <section className={CARD}>
        <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Recipient lists</h2>
        <ul className="divide-y divide-slate-100">
          {groups.map(([label, emails]) => (
            <li key={label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-slate-800">
                {label} <span className="text-slate-500">({emails.length})</span>
              </span>
              {emails.length > 0 && <CopyButton text={emails.join(", ")} label="Copy emails" />}
            </li>
          ))}
        </ul>
      </section>
      <section className={`${CARD} p-5 text-sm`}>
        <h2 className="font-semibold text-slate-900">Confirmation message</h2>
        <p className="mt-1 whitespace-pre-line text-slate-600">{event.confirmation_message ?? "Using the standard message: \"We have your spot saved. See you there.\""}</p>
        <Link href={`/events/${event.id}/edit?step=2`} className="mt-2 inline-block font-medium text-brand-600 hover:underline">Edit</Link>
      </section>
    </div>
  );
}

export function FilesTab({ detail }: { detail: EventDetail }) {
  const { event, documents, videos } = detail;
  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Materials ({documents.length})</h2>
            <p className="text-xs text-slate-500">Visible to your team only. Up to 50 MB per file.</p>
          </div>
          <DocumentUpload eventId={event.id} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {documents.map((d) => (
            <DocumentRow key={d.id} id={d.id} eventId={event.id} title={d.title} downloadUrl={d.downloadUrl} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-900">Event videos ({videos.length})</h2>
        <p className="text-xs text-slate-500">Visible to your team only.</p>
        <div className="mt-3"><VideoForm eventId={event.id} /></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {videos.map((v) => {
            const embedUrl = getVideoEmbedUrl(v.url!);
            return (
              <div key={v.id} className={`${CARD} p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <a href={v.url!} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm font-medium text-brand-600 hover:underline">{v.title}</a>
                  <RemoveResourceButton id={v.id} eventId={event.id} label={v.title} />
                </div>
                {embedUrl && <iframe src={embedUrl} title={v.title} allowFullScreen loading="lazy" className="mt-2 aspect-video w-full rounded-lg border-0" />}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const ANALYTICS_DAYS = 30;

function ResultsPanel({ report }: { report: EventReportRow }) {
  const panels: { title: string; rows: [string, string][] }[] = [
    {
      title: "People",
      rows: [
        ["Registered", String(report.people.registered)],
        ["Checked in", String(report.people.checkedIn)],
        ["On waitlist", String(report.people.waitlisted)],
        ["New contacts", String(report.people.newContacts)],
        ["Companies", String(report.people.companies)],
      ],
    },
    {
      title: "Revenue",
      rows: [
        ["Tickets (estimated)", formatMoney(report.revenue.ticketsEstimated)],
        ["Sponsors and other", formatMoney(report.revenue.other)],
        ["Total revenue", formatMoney(report.revenue.total)],
        ["Open proposals after registering", formatMoney(report.revenue.openPipeline)],
        ["Proposals won after registering", formatMoney(report.revenue.closedWon)],
      ],
    },
    {
      title: "Costs",
      rows: [
        ["Budget", report.costs.budget === null ? "—" : formatMoney(report.costs.budget)],
        ["Committed", formatMoney(report.costs.committed)],
        ["Actual", formatMoney(report.costs.actual)],
        ["Per attendee", report.costPerAttendee === null ? "—" : formatMoney(report.costPerAttendee)],
        ["Net (revenue minus actual)", formatMoney(report.net)],
      ],
    },
  ];
  return (
    <section aria-label="Event results" className="grid gap-3 lg:grid-cols-3">
      {panels.map((panel) => (
        <div key={panel.title} className={`${CARD} p-4`}>
          <h2 className="font-semibold text-slate-900">{panel.title}</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            {panel.rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

export function AnalyticsTab({ detail, report }: { detail: EventDetail; report: EventReportRow | null }) {
  const { event, registrations } = detail;
  const active = registrations.filter((r) => r.status === "registered");
  if (registrations.length === 0) {
    return (
      <div className="space-y-5">
        {report && <ResultsPanel report={report} />}
        <EmptyState icon={Ticket} title="No registrations yet" description="Registration trends appear once people start registering." />
      </div>
    );
  }

  const checkedIn = active.filter((r) => r.checked_in_at).length;
  const online = active.filter((r) => r.attendance_mode === "online").length;
  const companies = new Set(active.map((r) => r.company_name?.trim().toLowerCase()).filter(Boolean)).size;

  // The 30 days ending at the newest registration.
  const byDay = new Map<string, number>();
  for (const r of registrations) {
    if (r.status === "cancelled") continue;
    const key = calgaryDateKey(r.created_at);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const lastKey = [...byDay.keys()].sort().at(-1);
  const days: { key: string; count: number }[] = [];
  if (lastKey) {
    const cursor = new Date(`${lastKey}T00:00:00Z`);
    for (let i = 0; i < ANALYTICS_DAYS; i++) {
      const key = cursor.toISOString().slice(0, 10);
      days.unshift({ key, count: byDay.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      {report && <ResultsPanel report={report} />}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Users} tone="bg-brand-50 text-brand-600" value={String(active.length)} label="Registered" detail={event.capacity ? `${percent(active.length, event.capacity)}% of ${event.capacity} capacity` : "No capacity limit"} />
        <Metric icon={ClipboardCheck} tone="bg-sky-50 text-sky-700" value={active.length ? `${percent(checkedIn, active.length)}%` : "—"} label="Attendance" detail={`${checkedIn} checked in`} />
        <Metric icon={Building2} tone="bg-slate-100 text-slate-600" value={String(companies)} label="Companies" detail="Named by registrants" />
        <Metric icon={MonitorPlay} tone="bg-accent-50 text-accent-700" value={String(online)} label="Attending online" detail={`${active.length - online} in person`} />
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className="font-semibold text-slate-900">Registrations per day</h2>
        <p className="text-xs text-slate-500">The 30 days up to the latest registration, excluding cancellations. Calgary time.</p>
        <div className="relative mt-4 overflow-x-auto">
          <div className="flex h-40 min-w-[560px] items-end gap-[2px] border-b border-slate-200">
            {days.map((d) => (
              <div key={d.key} title={`${dayLabel(d.key)}: ${d.count}`} className="group relative flex h-full flex-1 items-end hover:bg-slate-50">
                {d.count > 0 && (
                  <div className="w-full rounded-t bg-accent-700" style={{ height: `${(d.count / max) * 100}%` }} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex min-w-[560px] justify-between text-xs text-slate-500">
            <span>{days[0] && dayLabel(days[0].key)}</span>
            <span>Peak: {max} in a day</span>
            <span>{days.at(-1) && dayLabel(days.at(-1)!.key)}</span>
          </div>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">View as a table</summary>
          <table className="mt-2 w-full max-w-xs text-left">
            <thead className="text-xs text-slate-500">
              <tr><th scope="col" className="py-1 font-medium">Day</th><th scope="col" className="py-1 text-right font-medium">Registrations</th></tr>
            </thead>
            <tbody>
              {days.filter((d) => d.count > 0).map((d) => (
                <tr key={d.key} className="border-t border-slate-100">
                  <td className="py-1 text-slate-700">{dayLabel(d.key)}</td>
                  <td className="py-1 text-right text-slate-700">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
