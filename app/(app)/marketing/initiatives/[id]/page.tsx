import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, Plus } from "lucide-react";
import { DeleteInitiativeButton } from "@/components/marketing/delete-initiative";
import { InitiativeButton } from "@/components/marketing/initiative-dialog";
import { PlatformIcons } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/budgets/money";
import { getCurrentUser } from "@/lib/auth/session";
import { calgaryDateKey } from "@/lib/events/format";
import { initiativePhase, PHASE_META, POST_STATUSES, POST_STATUS_META } from "@/lib/marketing/constants";
import { getEventOptions, getInitiative, getPosts } from "@/lib/marketing/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [initiative, posts, members, events, user] = await Promise.all([getInitiative(id), getPosts({ initiativeId: id }), getTeamMembers(), getEventOptions().catch(() => []), getCurrentUser()]);
  if (!initiative) notFound();
  const phase = initiativePhase(initiative.startsOn, initiative.endsOn, calgaryDateKey(new Date()));
  const people = members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unnamed" }));
  const canDelete = user?.role === "admin" || initiative.createdBy === user?.id;

  return (
    <div className="space-y-5">
      <Link href="/marketing/initiatives" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        All initiatives
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{initiative.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PHASE_META[phase].pill}`}>{PHASE_META[phase].label}</span>
          </div>
          {initiative.objective && <p className="max-w-2xl whitespace-pre-wrap text-sm text-slate-700">{initiative.objective}</p>}
          <p className="text-sm text-slate-500">
            {initiative.datesLabel}
            {initiative.ownerName && ` · Owner: ${initiative.ownerName}`}
            {initiative.budget !== null && ` · Budget ${formatMoney(initiative.budget)}`}
          </p>
          {initiative.eventId && (
            <p className="text-sm">
              Promotes{" "}
              <Link href={`/events/${initiative.eventId}`} className="font-medium text-brand-700 hover:underline">
                {initiative.eventTitle ?? "an event"}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canDelete && <DeleteInitiativeButton id={initiative.id} name={initiative.name} postCount={posts.length} />}
          <InitiativeButton
            variant="secondary"
            members={people}
            events={events}
            initiative={{
              id: initiative.id,
              name: initiative.name,
              objective: initiative.objective ?? "",
              ownerId: initiative.ownerId,
              eventId: initiative.eventId,
              startsOn: initiative.startsOn ?? "",
              endsOn: initiative.endsOn ?? "",
              budget: initiative.budget === null ? "" : String(initiative.budget),
            }}
          />
          <Link href={`/marketing/posts/new?initiative=${initiative.id}`} className={buttonClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Plan a post
          </Link>
        </div>
      </header>

      <section aria-labelledby="initiative-posts">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="initiative-posts" className="text-sm font-semibold text-slate-700">
            Posts ({posts.length})
          </h3>
          <p className="flex flex-wrap gap-3 text-xs text-slate-500">
            {POST_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${POST_STATUS_META[s].dot}`} />
                {initiative.counts[s]} {POST_STATUS_META[s].label.toLowerCase()}
              </span>
            ))}
          </p>
        </div>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            No posts yet.{" "}
            <Link href={`/marketing/posts/new?initiative=${initiative.id}`} className="font-medium text-brand-700 hover:underline">
              Plan the first one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/marketing/posts/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <ImageIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <PlatformIcons platforms={p.platforms} className="h-3.5 w-3.5" />
                      {p.scheduledLabel ?? "Not scheduled"}
                    </span>
                  </span>
                  <PostStatusPill status={p.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
