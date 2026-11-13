"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CalendarDays, ExternalLink, MessageSquareWarning, PenLine, Sparkles, Target, Ticket, X } from "lucide-react";
import { PlatformIcon } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { autoRequestLabel } from "@/lib/marketing/constants";
import type { PostItem } from "@/lib/marketing/queries";

/** A quick look at a post from the planner, with the way into the post and its event. */
export function PostQuickView({ post, onClose }: { post: PostItem; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
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
      className="animate-pop m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="max-h-56 w-full bg-slate-100 object-cover" />
      )}
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <PostStatusPill status={post.status} size="sm" />
            <h2 id="quick-view-title" className="text-lg font-semibold leading-snug text-slate-900">
              {post.title}
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <dl className="space-y-1.5 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <dt className="sr-only">When</dt>
            <dd>{post.scheduledLabel ?? "Not scheduled"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">
              #
            </span>
            <dt className="sr-only">Channels</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {post.channels.length === 0 ? (
                <span className="text-slate-500">No channels chosen yet</span>
              ) : (
                post.channels.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1">
                    <PlatformIcon platform={c.platform} className="h-3.5 w-3.5" title="" />
                    {c.name}
                  </span>
                ))
              )}
            </dd>
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
                <Link href={`/marketing/initiatives/${post.initiative.id}`} className="hover:text-brand-700 hover:underline">
                  {post.initiative.name}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        {post.status === "requested" && post.reviewNote && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <MessageSquareWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            {post.reviewNote}
          </p>
        )}

        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
          {post.caption || <span className="italic text-slate-400">No copy yet.</span>}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
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
