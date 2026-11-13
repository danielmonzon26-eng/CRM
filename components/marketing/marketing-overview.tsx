import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, Hourglass, Package, PenLine, Send, Target, Ticket } from "lucide-react";
import { MARKETING_CATEGORY_LABELS, MARKETING_CATEGORY_STYLES } from "@/lib/budgets/marketing-items";
import { PlatformIcon, PlatformIcons } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { BarRow, Kpi, Panel, PanelEmpty } from "@/components/ui/dashboard";
import { PHASE_META, PLATFORM_META, POST_STATUSES, POST_STATUS_META } from "@/lib/marketing/constants";
import type { CoverageSlot, MarketingDashboard } from "@/lib/marketing/dashboard";
import type { PostItem } from "@/lib/marketing/queries";

const SLOT_LABEL = { 14: "2 weeks", 7: "1 week", 1: "1 day" } as const;

/** The Marketing landing page: what needs doing, what's going out, and how events are covered. */
export function MarketingOverview({ d }: { d: MarketingDashboard }) {
  const maxPlatform = Math.max(1, ...d.platformMonth.map((p) => p.total));

  return (
    <div className="space-y-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Hourglass}
          tone="bg-amber-50 text-amber-700"
          value={String(d.waiting)}
          label="Waiting approval"
          detail={d.waiting ? "Ready for an admin to review" : "Nothing waiting"}
          href="/marketing/approvals"
          alert={d.waiting > 0}
        />
        <Kpi
          icon={Send}
          tone="bg-emerald-50 text-emerald-700"
          value={String(d.next7.total)}
          label="Going out in 7 days"
          detail={d.next7.total ? `${d.next7.approved} approved · ${d.next7.notApproved} not yet` : "Nothing scheduled this week"}
          href="/marketing/planner"
          alert={d.next7.notApproved > 0}
        />
        <Kpi
          icon={PenLine}
          tone="bg-slate-100 text-slate-700"
          value={String(d.toWrite)}
          label="To write"
          detail="Requested, due in the next 2 weeks"
          href="/marketing/approvals"
        />
        <Kpi
          icon={AlertTriangle}
          tone={d.overdue ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}
          value={String(d.overdue)}
          label="Date passed"
          detail={d.overdue ? "Not approved before their date" : "Nothing missed"}
          href="/marketing/approvals"
          alert={d.overdue > 0}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Needs attention" subtitle="Date passed, or going out this week without approval" href="/marketing/approvals" linkLabel="Approvals" className="xl:col-span-2">
          {d.attention.length === 0 ? (
            <PanelEmpty icon={CheckCircle2}>Everything going out this week is approved.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.attention.map((p) => (
                <li key={p.id}>
                  <PostLine post={p} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`${d.monthLabel} by platform`} subtitle="Posts scheduled this month" href="/marketing/planner" linkLabel="Planner">
          <div className="space-y-2 p-3">
            {d.platformMonth.map((p) => (
              <div key={p.platform} className="px-2 py-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <PlatformIcon platform={p.platform} className="h-4 w-4" title="" />
                    {PLATFORM_META[p.platform].label}
                  </span>
                  <span className="font-medium tabular-nums text-slate-900">{p.total}</span>
                </div>
                <div
                  className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={POST_STATUSES.map((s) => `${p.counts[s]} ${POST_STATUS_META[s].label.toLowerCase()}`).join(", ")}
                >
                  {POST_STATUSES.map((s) =>
                    p.counts[s] ? <span key={s} className={POST_STATUS_META[s].dot} style={{ width: `${(p.counts[s] / maxPlatform) * 100}%` }} /> : null,
                  )}
                </div>
              </div>
            ))}
            <p className="flex flex-wrap gap-3 px-2 pt-1 text-xs text-slate-500">
              {POST_STATUSES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${POST_STATUS_META[s].dot}`} />
                  {POST_STATUS_META[s].label}
                </span>
              ))}
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Event coverage" subtitle="Posts for published events in the next 60 days" href="/events" linkLabel="Events" className="xl:col-span-2">
          {d.coverage.length === 0 ? (
            <PanelEmpty icon={Ticket}>No published events in the next 60 days.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-medium">Event</th>
                    {([14, 7, 1] as const).map((n) => (
                      <th key={n} scope="col" className="px-2 py-2 text-center font-medium">
                        {SLOT_LABEL[n]} before
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-2 text-right font-medium">Other posts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {d.coverage.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-5 py-2.5">
                        <Link href={`/events/${ev.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {ev.title}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {ev.whenLabel} · {ev.daysToGo === 0 ? "today" : `in ${ev.daysToGo} ${ev.daysToGo === 1 ? "day" : "days"}`}
                        </span>
                      </td>
                      {ev.slots.map((slot) => (
                        <td key={slot.days} className="px-2 py-2.5 text-center">
                          <Slot slot={slot} />
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{ev.otherPosts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Initiatives" subtitle="Active and upcoming" href="/marketing/initiatives">
          {d.initiatives.length === 0 ? (
            <PanelEmpty icon={Target}>No active initiatives. Create one to group a campaign&apos;s posts.</PanelEmpty>
          ) : (
            <div className="space-y-1 p-3">
              {d.initiatives.map((i) => {
                const total = i.counts.requested + i.counts.waiting_approval + i.counts.approved;
                return (
                  <BarRow
                    key={i.id}
                    href={`/marketing/initiatives/${i.id}`}
                    label={
                      <>
                        {i.name}{" "}
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PHASE_META[i.phase as keyof typeof PHASE_META].pill}`}>
                          {PHASE_META[i.phase as keyof typeof PHASE_META].label}
                        </span>
                      </>
                    }
                    value={i.counts.approved}
                    max={Math.max(total, 1)}
                    valueLabel={`${i.counts.approved} of ${total} approved`}
                    barClass="bg-emerald-500"
                  />
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Marketing items due" subtitle="From event budgets: overdue or due in the next 2 weeks" href="/marketing/deliverables" linkLabel="All items">
        {d.itemsDue.length === 0 ? (
          <PanelEmpty icon={Package}>Nothing due in the next two weeks.</PanelEmpty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.itemsDue.map((i) => {
              const late = !!i.due && i.due < d.today;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${MARKETING_CATEGORY_STYLES[i.category]}`}>{MARKETING_CATEGORY_LABELS[i.category]}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">{i.name}</span>
                  <Link href={`/events/${i.event.id}?tab=budget`} className="truncate text-xs text-slate-500 hover:text-brand-700 hover:underline">
                    {i.event.title}
                  </Link>
                  <span className={`text-xs tabular-nums ${late ? "font-medium text-rose-700" : "text-slate-600"}`}>
                    {late ? "Overdue · " : "Due "}
                    {new Date(`${i.due}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Approved and coming up" subtitle="Next 2 weeks" href="/marketing/planner" linkLabel="Planner">
        {d.upcoming.length === 0 ? (
          <PanelEmpty icon={CalendarCheck}>Nothing approved for the next two weeks yet.</PanelEmpty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.upcoming.map((p) => (
              <li key={p.id}>
                <PostLine post={p} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function PostLine({ post }: { post: PostItem }) {
  return (
    <Link href={`/marketing/posts/${post.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${post.isPast ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
        {post.isPast ? <AlertTriangle className="h-4 w-4" strokeWidth={2} /> : <Clock className="h-4 w-4" strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{post.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={post.isPast && post.status !== "approved" ? "font-medium text-rose-700" : ""}>{post.scheduledLabel}</span>
          <PlatformIcons platforms={post.platforms} className="h-3.5 w-3.5" />
        </span>
      </span>
      <PostStatusPill status={post.status} size="sm" />
    </Link>
  );
}

/** One automatic request for an event: its status, or why there isn't one. */
function Slot({ slot }: { slot: CoverageSlot }) {
  if (slot.postId && slot.status) {
    const meta = POST_STATUS_META[slot.status];
    return (
      <Link href={`/marketing/posts/${slot.postId}`} title={meta.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium hover:ring-2 hover:ring-brand-200 ${meta.pill}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label === "Waiting approval" ? "Waiting" : meta.label}
      </Link>
    );
  }
  return <span className="text-xs text-slate-400">{slot.passed ? "Passed" : "None"}</span>;
}
