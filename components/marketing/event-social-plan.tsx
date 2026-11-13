"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, X } from "lucide-react";
import { deletePost, saveEventPost } from "@/app/actions/marketing";
import { PlatformIcon, PlatformIcons } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { useFeedback } from "@/components/ui/feedback";
import type { Channel, PostItem } from "@/lib/marketing/queries";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";

const SLOTS = [
  { days: 28, label: "4 weeks before" },
  { days: 14, label: "2 weeks before" },
  { days: 7, label: "1 week before" },
  { days: 1, label: "1 day before" },
];
/** The most posts an event can have (the server enforces the same). */
const MAX_POSTS = 3;
const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));

function slotDay(eventDay: string, days: number) {
  const d = new Date(`${eventDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const daysOf = (p: PostItem) => p.eventDaysBefore ?? p.autoDaysBefore ?? null;

/** What the popup opens on: a new post (at a timing, or on a date) or one to change. */
type Editing = { post: PostItem } | { timing: string };

/**
 * The event's social media plan: up to three posts, one at each of 4 weeks, 2 weeks, 1 week
 * and 1 day before, or on dates you pick. Click a slot to plan a post there, or a post to
 * change it. Each one is a request in Marketing → Social Planner, to be written and approved there.
 */
export function EventSocialPlan({ eventId, eventDay, posts, channels, today }: { eventId: string; eventDay: string; posts: PostItem[]; channels: Channel[]; today: string }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const custom = posts.filter((p) => daysOf(p) === null).sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const full = posts.length >= MAX_POSTS;

  return (
    <section aria-labelledby="event-social-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2 rounded-t-xl border-b border-slate-200/70 bg-slate-50/80 px-5 py-4">
        <div>
          <h2 id="event-social-title" className="text-lg font-semibold text-slate-900">
            Social media
          </h2>
          <p className="text-xs text-slate-500">Up to three posts per event. Click a slot to plan one, or a post to change it. Each goes to Marketing → Social Planner to be written and approved.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${full ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {Math.min(posts.length, MAX_POSTS)} of {MAX_POSTS} planned
          </span>
          <Link href="/marketing/social" className="text-sm font-medium text-brand-700 hover:underline">
            Post calendar
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
        {SLOTS.map((slot) => {
          const list = posts.filter((p) => daysOf(p) === slot.days);
          const day = slotDay(eventDay, slot.days);
          const past = day < today;
          return (
            <div key={slot.days} className={`rounded-lg border p-3 ${past ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
              <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
              <p className="text-xs text-slate-500">
                {fmtDay(day)}
                {past && " · passed"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {list.map((p) => (
                  <PostCard key={p.id} post={p} onOpen={() => setEditing({ post: p })} />
                ))}
                {list.length === 0 && !past && !full && (
                  <li>
                    <AddButton onClick={() => setEditing({ timing: String(slot.days) })}>Plan a post</AddButton>
                  </li>
                )}
                {list.length === 0 && (past || full) && <li className="text-xs text-slate-400">{past ? "No post" : "Not used"}</li>}
              </ul>
            </div>
          );
        })}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Other dates</p>
          <p className="text-xs text-slate-500">Posts on a date you pick</p>
          <ul className="mt-2 space-y-1.5">
            {custom.map((p) => (
              <PostCard key={p.id} post={p} onOpen={() => setEditing({ post: p })} />
            ))}
            {!full ? (
              <li>
                <AddButton onClick={() => setEditing({ timing: "custom" })}>Pick a date</AddButton>
              </li>
            ) : (
              custom.length === 0 && <li className="text-xs text-slate-400">Not used</li>
            )}
          </ul>
        </div>
      </div>
      {full && <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">Three posts planned, the most for one event. Click a post to change its timing or remove it.</p>}

      {editing && (
        <PostDialog
          key={"post" in editing ? editing.post.id : editing.timing}
          eventId={eventId}
          eventDay={eventDay}
          today={today}
          posts={posts}
          channels={channels}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

function PostCard({ post, onOpen }: { post: PostItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Change post: ${post.title}`}
        className="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-brand-300 hover:bg-brand-50/30"
      >
        <span className="flex items-start justify-between gap-1.5">
          <span className="line-clamp-2 text-xs font-medium text-slate-900">{post.title}</span>
          {post.autoDaysBefore && <Sparkles aria-label="Automatic request" className="h-3 w-3 shrink-0 text-violet-500" strokeWidth={2} />}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <PostStatusPill status={post.status} size="sm" />
          {post.platforms.length ? <PlatformIcons platforms={post.platforms} className="h-3 w-3" /> : <span className="text-[11px] text-slate-400">No channels</span>}
          {daysOf(post) === null && post.dayKey && <span className="text-[11px] text-slate-500">{fmtDay(post.dayKey)}</span>}
          {post.timeLabel && <span className="text-[11px] text-slate-500">{post.timeLabel}</span>}
        </span>
      </button>
    </li>
  );
}

function PostDialog({
  eventId,
  eventDay,
  today,
  posts,
  channels,
  editing,
  onClose,
}: {
  eventId: string;
  eventDay: string;
  today: string;
  posts: PostItem[];
  channels: Channel[];
  editing: Editing;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const post = "post" in editing ? editing.post : null;
  const postDays = post ? daysOf(post) : null;
  const [timing, setTiming] = useState(post ? (postDays === null ? "custom" : String(postDays)) : (editing as { timing: string }).timing);
  const [date, setDate] = useState(post && postDays === null ? (post.dayKey ?? "") : "");
  const [time, setTime] = useState(post?.scheduledInput.slice(11, 16) || "09:00");
  const [topic, setTopic] = useState(post?.title ?? "");
  const [channelIds, setChannelIds] = useState<string[]>(() => (post ? post.channels.map((c) => c.id) : channels.map((c) => c.id)));
  const taken = (days: number) => posts.some((p) => p.id !== post?.id && daysOf(p) === days);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveEventPost({ eventId, postId: post?.id ?? null, timing, date, time, topic, channelIds }).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) return setError(result.error);
      toast(post ? "Post updated." : "Post planned. It's in Marketing → Social Planner to write and approve.");
      router.refresh();
      ref.current?.close();
    });
  }

  function remove() {
    if (!post) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePost(post.id).catch(() => ({ error: "That post wasn't removed. Please try again." }));
      if (result.error) return setError(result.error);
      toast("Post removed.");
      router.refresh();
      ref.current?.close();
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="event-post-title"
      className="animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form onSubmit={save}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="event-post-title" className="text-lg font-semibold text-slate-900">
              {post ? "Change post" : "Plan a post"}
            </h2>
            {post && (
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <PostStatusPill status={post.status} size="sm" />
                <Link href={`/marketing/posts/${post.id}`} className="font-medium text-brand-700 hover:underline">
                  Open to write it
                </Link>
              </p>
            )}
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <label className={LABEL}>
            What to cover
            <input
              required
              autoFocus
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Speaker announcement, early-bird reminder, last call"
              className={FIELD}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
            <label className={LABEL}>
              When
              <select value={timing} onChange={(e) => setTiming(e.target.value)} className={FIELD}>
                {SLOTS.map((s) => {
                  const day = slotDay(eventDay, s.days);
                  const passed = day < today;
                  const off = taken(s.days) || (passed && timing !== String(s.days));
                  return (
                    <option key={s.days} value={String(s.days)} disabled={off}>
                      {s.label} ({fmtDay(day)}){taken(s.days) ? " · has a post" : passed ? " · passed" : ""}
                    </option>
                  );
                })}
                <option value="custom">A date I pick</option>
              </select>
            </label>
            <label className={LABEL}>
              Time
              <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
            </label>
          </div>
          {timing === "custom" && (
            <label className={`${LABEL} max-w-xs`}>
              Date
              <DateInput aria-label="Post date" required value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
            </label>
          )}
          <fieldset>
            <legend className={LABEL}>Where</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {channels.length === 0 && <span className="text-sm text-slate-500">No channels yet. Add them under Marketing → Social Planner → Channels.</span>}
              {channels.map((c) => {
                const on = channelIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-200 ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700"}`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setChannelIds(on ? channelIds.filter((x) => x !== c.id) : [...channelIds, c.id])} />
                    <PlatformIcon platform={c.platform} className="h-3.5 w-3.5" title="" />
                    {c.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <div>
            {post &&
              (confirmRemove ? (
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  Remove this post?
                  <button type="button" onClick={remove} disabled={pending} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                    Remove
                  </button>
                  <button type="button" onClick={() => setConfirmRemove(false)} className="text-sm font-medium text-slate-600 hover:underline">
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm font-medium text-rose-700 hover:underline">
                  Remove post
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button type="submit" disabled={pending || !topic.trim() || (timing === "custom" && !date)} className={buttonClass("primary")}>
              {pending ? "Saving..." : post ? "Save changes" : "Plan post"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
