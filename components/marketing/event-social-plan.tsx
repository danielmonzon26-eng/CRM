"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, Sparkles } from "lucide-react";
import { scheduleEventPost } from "@/app/actions/marketing";
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
const MAX_PER_SLOT = 2;
const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function slotDay(eventDay: string, days: number) {
  const d = new Date(`${eventDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * The event's social media plan: up to two posts at each of 4 weeks, 2 weeks, 1 week and
 * 1 day before, plus posts on set dates. Each one is a request in Marketing → Social, to
 * be written and approved there.
 */
export function EventSocialPlan({ eventId, eventDay, posts, channels, today }: { eventId: string; eventDay: string; posts: PostItem[]; channels: Channel[]; today: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState("28");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [topic, setTopic] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>(() => channels.map((c) => c.id));

  const daysOf = (p: PostItem) => p.eventDaysBefore ?? p.autoDaysBefore ?? null;
  const custom = posts.filter((p) => daysOf(p) === null).sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const full = (days: number) => posts.filter((p) => daysOf(p) === days).length >= MAX_PER_SLOT;

  function plan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await scheduleEventPost({ eventId, timing, date, time, topic, channelIds }).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) return setError(result.error);
      toast("Post planned. It's in Marketing → Social to write and approve.");
      setTopic("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="event-social-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 id="event-social-title" className="font-semibold text-slate-900">
            Social media
          </h2>
          <p className="text-xs text-slate-500">Plan what to post and when. Each post goes to Marketing → Social to be written and approved, and moves if the event does.</p>
        </div>
        <Link href="/marketing/social" className="text-sm font-medium text-brand-700 hover:underline">
          Post calendar
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {SLOTS.map((slot) => {
          const list = posts.filter((p) => daysOf(p) === slot.days);
          const day = slotDay(eventDay, slot.days);
          const past = day < today;
          return (
            <div key={slot.days} className={`rounded-lg border p-3 ${past ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
              <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
              <p className="text-xs text-slate-500">
                {dayFmt.format(new Date(`${day}T00:00:00Z`))}
                {past && " · passed"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {list.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
                {list.length < MAX_PER_SLOT && !past && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setTiming(String(slot.days));
                        document.getElementById(`plan-topic-${eventId}`)?.focus();
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      {list.length ? "Add a second post" : "Plan a post"}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Other dates</p>
          <p className="text-xs text-slate-500">Posts on a date you pick</p>
          <ul className="mt-2 space-y-1.5">
            {custom.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
            {custom.length === 0 && <li className="text-xs text-slate-400">None yet</li>}
          </ul>
        </div>
      </div>

      <form onSubmit={plan} className="space-y-3 border-t border-slate-100 px-5 py-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <CalendarClock className="h-4 w-4 text-slate-400" strokeWidth={2} />
          Plan a post
        </p>
        <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_130px]">
          <label className={LABEL}>
            When
            <select value={timing} onChange={(e) => setTiming(e.target.value)} className={FIELD}>
              {SLOTS.map((s) => (
                <option key={s.days} value={String(s.days)} disabled={full(s.days)}>
                  {s.label}
                  {full(s.days) ? " (two planned)" : ""}
                </option>
              ))}
              <option value="custom">Custom date</option>
            </select>
          </label>
          <label className={LABEL}>
            What to cover
            <input
              id={`plan-topic-${eventId}`}
              required
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Speaker announcement, early-bird reminder, last call"
              className={FIELD}
            />
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
            {channels.length === 0 && <span className="text-sm text-slate-500">No channels yet. Add them under Marketing → Social → Channels.</span>}
            {channels.map((c) => {
              const on = channelIds.includes(c.id);
              return (
                <label key={c.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700"}`}>
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
        <div className="flex justify-end">
          <button type="submit" disabled={pending || !topic.trim() || (timing === "custom" && !date)} className={buttonClass("primary")}>
            {pending ? "Planning..." : "Plan post"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PostCard({ post }: { post: PostItem }) {
  return (
    <li>
      <Link href={`/marketing/posts/${post.id}`} className="block rounded-md border border-slate-200 bg-white px-2 py-1.5 hover:border-brand-300 hover:bg-brand-50/30">
        <span className="flex items-start justify-between gap-1.5">
          <span className="line-clamp-2 text-xs font-medium text-slate-900">{post.title}</span>
          {post.autoDaysBefore && <Sparkles aria-label="Automatic request" className="h-3 w-3 shrink-0 text-violet-500" strokeWidth={2} />}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <PostStatusPill status={post.status} size="sm" />
          <PlatformIcons platforms={post.platforms} className="h-3 w-3" />
          {post.timeLabel && <span className="text-[11px] text-slate-500">{post.timeLabel}</span>}
        </span>
      </Link>
    </li>
  );
}
