import Link from "next/link";
import { CalendarDays, Target, Ticket, User } from "lucide-react";
import { InitiativeButton } from "@/components/marketing/initiative-dialog";
import { EmptyState } from "@/components/ui/page";
import { LoadError } from "@/components/ui/load-error";
import { formatMoney } from "@/lib/budgets/money";
import { calgaryDateKey } from "@/lib/events/format";
import { initiativePhase, PHASE_META, POST_STATUSES, POST_STATUS_META } from "@/lib/marketing/constants";
import { getEventOptions, getInitiatives } from "@/lib/marketing/queries";
import { getTeamMembers } from "@/lib/leads/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

const PHASE_ORDER = { active: 0, upcoming: 1, undated: 2, finished: 3 } as const;

export default async function InitiativesPage() {
  const [initiatives, members, events] = await Promise.all([settle(getInitiatives()), getTeamMembers(), getEventOptions().catch(() => [])]);
  if (!initiatives.ok) return <LoadError what="Initiatives" />;
  const today = calgaryDateKey(new Date());
  const people = members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unnamed" }));
  const list = initiatives.value
    .map((i) => ({ ...i, phase: initiativePhase(i.startsOn, i.endsOn, today) }))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Group posts under a campaign or push, with dates, an owner and the event it promotes.</p>
        <InitiativeButton members={people} events={events} />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Target} title="No initiatives yet" description="Create one for a campaign, like promoting Pitch Night, then plan its posts from there." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => {
            const total = POST_STATUSES.reduce((sum, s) => sum + i.counts[s], 0);
            return (
              <li key={i.id}>
                <Link
                  href={`/marketing/initiatives/${i.id}`}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">{i.name}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PHASE_META[i.phase].pill}`}>{PHASE_META[i.phase].label}</span>
                  </div>
                  {i.objective && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{i.objective}</p>}
                  <dl className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      <dt className="sr-only">Dates</dt>
                      <dd>{i.datesLabel}</dd>
                    </div>
                    {i.ownerName && (
                      <div className="flex items-center gap-1.5">
                        <User aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        <dt className="sr-only">Owner</dt>
                        <dd>{i.ownerName}</dd>
                      </div>
                    )}
                    {i.eventTitle && (
                      <div className="flex items-center gap-1.5">
                        <Ticket aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        <dt className="sr-only">Event</dt>
                        <dd className="truncate">{i.eventTitle}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {total} {total === 1 ? "post" : "posts"}
                        {i.budget !== null && ` · ${formatMoney(i.budget)}`}
                      </span>
                      {i.nextPostLabel && <span>Next: {i.nextPostLabel}</span>}
                    </div>
                    {total > 0 && (
                      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={POST_STATUSES.map((s) => `${i.counts[s]} ${POST_STATUS_META[s].label.toLowerCase()}`).join(", ")}>
                        {POST_STATUSES.map((s) => (
                          <span key={s} className={POST_STATUS_META[s].dot} style={{ width: `${(i.counts[s] / total) * 100}%` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
