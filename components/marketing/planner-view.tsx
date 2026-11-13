"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, ImageIcon, Plus } from "lucide-react";
import { PlatformIcon, PlatformIcons } from "@/components/marketing/platform-icon";
import { PostQuickView } from "@/components/marketing/post-quick-view";
import { MARKETING_CATEGORY_LABELS, MARKETING_CATEGORY_STYLES } from "@/lib/budgets/marketing-items";
import type { MarketingItem } from "@/lib/marketing/items-queries";
import { RequestPostDialog } from "@/components/marketing/request-post";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { PLATFORMS, POST_STATUSES, POST_STATUS_META } from "@/lib/marketing/constants";
import type { PostItem } from "@/lib/marketing/queries";
import type { SocialPlatform, SocialPostStatus } from "@/lib/supabase/types";

type Day = { key: string; day: number; inMonth: boolean; isToday: boolean; isPast: boolean };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;
const agendaDay = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export function PlannerView({
  monthLabel,
  month,
  prevMonth,
  nextMonth,
  thisMonth,
  days,
  posts,
  unscheduled,
  items = [],
  basePath = "/marketing/social",
}: {
  monthLabel: string;
  month: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  days: Day[];
  posts: PostItem[];
  unscheduled: PostItem[];
  /** Marketing items to show on their due dates (the Planner shows these; Social doesn't). */
  items?: MarketingItem[];
  /** Where month navigation points. */
  basePath?: string;
}) {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [statuses, setStatuses] = useState<SocialPostStatus[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The day a request is being made for ("" for no date); null when the popup is closed.
  const [requestDay, setRequestDay] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PostItem | null>(null);

  const matches = (p: PostItem) =>
    (platforms.length === 0 || p.platforms.some((x) => platforms.includes(x))) && (statuses.length === 0 || statuses.includes(p.status));
  const visible = useMemo(() => posts.filter(matches), [posts, platforms, statuses]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => {
    const map = new Map<string, PostItem[]>();
    for (const p of visible) if (p.dayKey) map.set(p.dayKey, [...(map.get(p.dayKey) ?? []), p]);
    return map;
  }, [visible]);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, MarketingItem[]>();
    for (const i of items) if (i.due && i.status !== "done") map.set(i.due, [...(map.get(i.due) ?? []), i]);
    return map;
  }, [items]);
  const unscheduledVisible = unscheduled.filter(matches);
  const monthDays = days.filter((d) => d.inMonth && (byDay.has(d.key) || itemsByDay.has(d.key)));
  const filtered = platforms.length > 0 || statuses.length > 0;

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?month=${prevMonth}`} aria-label="Previous month" className={buttonClass("secondary", "sm")}>
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link href={`${basePath}?month=${nextMonth}`} aria-label="Next month" className={buttonClass("secondary", "sm")}>
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <h2 className="ml-1 text-lg font-semibold text-slate-900" aria-live="polite">
            {monthLabel}
          </h2>
          {month !== thisMonth && (
            <Link href={basePath} className="ml-1 text-sm font-medium text-brand-700 hover:underline">
              Today
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter posts">
          {PLATFORMS.map((p) => {
            const on = platforms.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPlatforms(toggle(platforms, p.key))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <PlatformIcon platform={p.key} className="h-3.5 w-3.5" title="" />
                {p.label}
              </button>
            );
          })}
          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          {POST_STATUSES.map((s) => {
            const on = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setStatuses(toggle(statuses, s))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${POST_STATUS_META[s].dot}`} />
                {POST_STATUS_META[s].label}
              </button>
            );
          })}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setPlatforms([]);
                setStatuses([]);
              }}
              className="px-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        {/* Month grid, from tablet width up. */}
        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card md:block">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const dayPosts = byDay.get(d.key) ?? [];
              const open = expanded === d.key;
              const shown = open ? dayPosts : dayPosts.slice(0, MAX_PER_DAY);
              return (
                <div
                  key={d.key}
                  className={`group relative min-h-[118px] border-slate-100 p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < days.length - 7 ? "border-b" : ""} ${
                    d.inMonth ? "bg-white" : "bg-slate-50/70"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                        d.isToday ? "bg-brand-600 text-white" : d.inMonth ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {d.day}
                      {d.isToday && <span className="sr-only"> (today)</span>}
                    </span>
                    {!d.isPast && (
                      <button
                        type="button"
                        onClick={() => setRequestDay(d.key)}
                        aria-label={`Request a post on ${d.key}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-700 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                  {(itemsByDay.get(d.key) ?? []).length > 0 && (
                    <ul className="mb-1 space-y-1">
                      {(itemsByDay.get(d.key) ?? []).map((i) => (
                        <li key={i.id}>
                          <ItemChip item={i} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul className="space-y-1">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <PostChip post={p} onOpen={() => setViewing(p)} />
                      </li>
                    ))}
                  </ul>
                  {dayPosts.length > MAX_PER_DAY && (
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : d.key)}
                      className="mt-1 w-full rounded px-1 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      {open ? "Show fewer" : `+${dayPosts.length - MAX_PER_DAY} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda list on phones. */}
        <div className="space-y-3 md:hidden">
          {monthDays.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
              {filtered ? "No posts match these filters this month." : "Nothing scheduled this month yet."}
            </p>
          ) : (
            monthDays.map((d) => (
              <section key={d.key} aria-label={agendaDay.format(new Date(`${d.key}T00:00:00Z`))}>
                <h3 className={`mb-1.5 text-sm font-semibold ${d.isToday ? "text-brand-700" : "text-slate-700"}`}>
                  {agendaDay.format(new Date(`${d.key}T00:00:00Z`))}
                  {d.isToday && " · Today"}
                </h3>
                <ul className="space-y-1.5">
                  {(itemsByDay.get(d.key) ?? []).map((i) => (
                    <li key={i.id}>
                      <ItemChip item={i} />
                    </li>
                  ))}
                  {(byDay.get(d.key) ?? []).map((p) => (
                    <li key={p.id}>
                      <PostRow post={p} onOpen={() => setViewing(p)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="unscheduled-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 id="unscheduled-title" className="text-sm font-semibold text-slate-900">
                Not scheduled yet ({unscheduledVisible.length})
              </h3>
              <button type="button" onClick={() => setRequestDay("")} className="text-xs font-medium text-brand-700 hover:underline">
                Add
              </button>
            </header>
            {unscheduledVisible.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">Posts without a date land here, so ideas don&apos;t get lost.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {unscheduledVisible.map((p) => (
                  <li key={p.id}>
                    <PostRow post={p} flat onOpen={() => setViewing(p)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Status key" className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-card">
            <ul className="space-y-1.5">
              {POST_STATUSES.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${POST_STATUS_META[s].dot}`} />
                  <span>
                    <span className="font-medium text-slate-800">{POST_STATUS_META[s].label}</span>: {POST_STATUS_META[s].hint.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {posts.length === 0 && unscheduled.length === 0 && (
            <button type="button" onClick={() => setRequestDay("")} className={`${buttonClass("secondary")} w-full`}>
              <CalendarPlus className="h-4 w-4" strokeWidth={2} />
              Request your first post
            </button>
          )}
        </aside>
      </div>
      {requestDay !== null && <RequestPostDialog date={requestDay} onClose={() => setRequestDay(null)} />}
      {viewing && <PostQuickView post={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** A post in a calendar day: status colour on the left, time, channels and title. */
function PostChip({ post, onOpen }: { post: PostItem; onOpen: () => void }) {
  const meta = POST_STATUS_META[post.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${post.title} · ${meta.label}${post.timeLabel ? ` · ${post.timeLabel}` : ""}`}
      className="flex w-full items-stretch gap-1.5 overflow-hidden rounded-md border text-left border-slate-200 bg-white py-1 pl-1 pr-1.5 text-[11px] leading-tight text-slate-800 shadow-sm hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span aria-hidden="true" className={`w-1 shrink-0 rounded-full ${meta.dot}`} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{meta.label}: </span>
        <span className="block truncate font-medium">{post.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-slate-500">
          <span className="tabular-nums">{post.timeLabel}</span>
          {post.platforms.map((p) => (
            <PlatformIcon key={p} platform={p} className="h-3 w-3 shrink-0" />
          ))}
        </span>
      </span>
    </button>
  );
}

function PostRow({ post, flat = false, onOpen }: { post: PostItem; flat?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${flat ? "" : "rounded-lg border border-slate-200 bg-white shadow-sm"}`}
    >
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
          <ImageIcon className="h-4 w-4" strokeWidth={2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{post.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <PlatformIcons platforms={post.platforms} className="h-3.5 w-3.5" />
          {post.timeLabel && <span>{post.timeLabel}</span>}
        </span>
      </span>
      <PostStatusPill status={post.status} size="sm" />
    </button>
  );
}

/** A marketing item on its due date: its type colour, stream and description; opens the table. */
function ItemChip({ item }: { item: MarketingItem }) {
  return (
    <Link
      href="/marketing/planner?view=table"
      title={`${MARKETING_CATEGORY_LABELS[item.type]} · ${item.name}${item.event ? ` · ${item.event.title}` : ""}`}
      className={`flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight hover:ring-2 hover:ring-brand-200 ${MARKETING_CATEGORY_STYLES[item.type] ?? "bg-slate-100 text-slate-700"}`}
    >
      <span className="shrink-0 rounded bg-white/70 px-1 text-[10px] uppercase tracking-wide">{item.stream === "catapult" ? "Cat" : item.stream === "event" ? "Evt" : "Spn"}</span>
      <span className="truncate">{item.name}</span>
    </Link>
  );
}
