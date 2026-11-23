"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Check, ExternalLink, MessageSquareWarning, PenLine, Sparkles, Target, Ticket, X } from "lucide-react";
import { PlatformIcon } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { autoRequestLabel } from "@/lib/marketing/constants";
import { setPostChannels } from "@/app/actions/marketing";
import type { Channel, PostItem } from "@/lib/marketing/queries";

/** A quick look at a post from the planner, with the way into the post and its event. */
export function PostQuickView({ post, channels = [], onClose }: { post: PostItem; channels?: Channel[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const saved = post.channels.map((c) => c.id);
  const [chosen, setChosen] = useState<string[]>(saved);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  // Active channels, plus any inactive one the post already uses.
  const options = [...channels.filter((c) => c.active), ...post.channels.filter((c) => !channels.some((x) => x.id === c.id && x.active))];
  const changed = chosen.length !== saved.length || chosen.some((id) => !saved.includes(id));
  const toggle = (id: string) => {
    setMessage(null);
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const saveChannels = () =>
    start(async () => {
      const result = await setPostChannels(post.id, chosen);
      if (result.error) setMessage({ tone: "error", text: result.error });
      else {
        setMessage({ tone: "ok", text: post.status === "approved" ? "Channels saved. If you're not an admin, it goes back for approval." : "Channels saved." });
        router.refresh();
      }
    });
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop closes it.
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="quick-view-title"
      className="animate-pop m-auto w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto rounded-2xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="max-h-72 w-full bg-slate-100 object-cover" />
      )}
      <div className="space-y-5 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <PostStatusPill status={post.status} size="sm" />
            <h2 id="quick-view-title" className="text-2xl font-semibold leading-snug tracking-tight text-slate-900">
              {post.title}
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <dl className="space-y-2 text-[15px] text-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <dt className="sr-only">When</dt>
            <dd>{post.scheduledLabel ?? "Not scheduled"}</dd>
          </div>
          {post.event && (
            <div className="flex items-center gap-2">
              <Ticket aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <dt className="sr-only">Event</dt>
              <dd>
                {post.event.title}
                {post.autoDaysBefore && (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">
                    <Sparkles aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
                    Auto · {autoRequestLabel(post.autoDaysBefore)}
                  </span>
                )}
              </dd>
            </div>
          )}
          {post.initiative && (
            <div className="flex items-center gap-2">
              <Target aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <dt className="sr-only">Initiative</dt>
              <dd>
                <Link href={`/marketing/social/initiatives/${post.initiative.id}`} className="hover:text-brand-700 hover:underline">
                  {post.initiative.name}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <section aria-labelledby="quick-view-channels" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="quick-view-channels" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Post to
            </h3>
            {chosen.length === 0 && <span className="text-xs text-slate-500">Pick at least one channel.</span>}
          </div>
          {options.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No channels set up yet.{" "}
              <Link href="/marketing/social/channels" className="font-medium text-brand-700 hover:underline">
                Add channels
              </Link>
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((c) => {
                const on = chosen.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      on ? "border-brand-600 bg-white text-slate-900 ring-2 ring-brand-100" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <PlatformIcon platform={c.platform} className="h-4 w-4" title="" />
                    {c.name}
                    {on && <Check aria-hidden="true" className="h-4 w-4 text-brand-600" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
          {(changed || message) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {changed && (
                <button type="button" onClick={saveChannels} disabled={pending} className={buttonClass("primary", "sm")}>
                  {pending ? "Saving..." : "Save channels"}
                </button>
              )}
              {message && (
                <p role="status" className={`text-sm ${message.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                  {message.text}
                </p>
              )}
            </div>
          )}
        </section>

        {post.status === "requested" && post.reviewNote && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <MessageSquareWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            {post.reviewNote}
          </p>
        )}

        <section aria-labelledby="quick-view-copy">
          <h3 id="quick-view-copy" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Post copy
          </h3>
          <p className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white px-5 py-4 text-base leading-relaxed text-slate-800">
            {post.caption || <span className="italic text-slate-400">No copy yet.</span>}
          </p>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:px-7">
        {post.event && (
          <Link href={`/events/${post.event.id}`} className={buttonClass("secondary")}>
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
            View event
          </Link>
        )}
        <Link href={`/marketing/posts/${post.id}`} className={buttonClass("primary")}>
          <PenLine className="h-4 w-4" strokeWidth={2} />
          {post.status === "approved" ? "Open post" : "Open and edit"}
        </Link>
      </div>
    </dialog>
  );
}
