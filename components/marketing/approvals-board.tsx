"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ImageIcon, MessageSquareWarning, Sparkles, Undo2 } from "lucide-react";
import { setPostStatus } from "@/app/actions/marketing";
import { PlatformIcons } from "@/components/marketing/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { autoRequestLabel, POST_STATUSES, POST_STATUS_META, readinessIssues } from "@/lib/marketing/constants";
import type { PostItem } from "@/lib/marketing/queries";
import type { SocialPostStatus } from "@/lib/supabase/types";

const EMPTY: Record<SocialPostStatus, string> = {
  requested: "No requests. New post ideas start here.",
  waiting_approval: "Nothing waiting. Posts submitted for approval show here.",
  approved: "Nothing approved yet.",
};

/** Posts in three columns by status, with approve and send-back right on the card. */
export function ApprovalsBoard({ posts, isAdmin, userId }: { posts: PostItem[]; isAdmin: boolean; userId: string }) {
  const [mineOnly, setMineOnly] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const visible = posts.filter((p) => (!mineOnly || p.createdBy === userId) && (showPast || !p.isPast || p.status !== "approved"));
  const hiddenPast = posts.filter((p) => p.isPast && p.status === "approved").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {isAdmin ? "You can approve posts, or send them back with a note." : "An admin approves posts before they go out. Submit yours when it's ready."}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
            Only mine
          </label>
          {hiddenPast > 0 && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
              Show {hiddenPast} already gone out
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {POST_STATUSES.map((status) => {
          const column = visible.filter((p) => p.status === status);
          const meta = POST_STATUS_META[status];
          return (
            <section key={status} aria-labelledby={`col-${status}`} className={`flex min-h-40 flex-col rounded-xl border border-t-4 border-slate-200 bg-slate-50/70 ${meta.column}`}>
              <header className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-3">
                <h2 id={`col-${status}`} className="text-sm font-semibold text-slate-900">
                  {meta.label} <span className="font-normal text-slate-500">({column.length})</span>
                </h2>
                <span className="text-xs text-slate-500">{meta.hint}</span>
              </header>
              {column.length === 0 ? (
                <p className="mx-3 mb-3 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">{EMPTY[status]}</p>
              ) : (
                <ul className="space-y-2 px-3 pb-3">
                  {column.map((p) => (
                    <li key={p.id}>
                      <PostCard post={p} isAdmin={isAdmin} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PostCard({ post, isAdmin }: { post: PostItem; isAdmin: boolean }) {
  const router = useRouter();
  const { toast, promptText } = useFeedback();
  const [pending, startTransition] = useTransition();

  function move(next: SocialPostStatus, note?: string) {
    startTransition(async () => {
      const result = await setPostStatus(post.id, next, note).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) toast(result.error, "error");
      else {
        toast(next === "approved" ? `Approved "${post.title}".` : next === "requested" ? "Sent back with your note." : "Submitted for approval.");
        router.refresh();
      }
    });
  }

  const overdue = post.isPast && post.status !== "approved";
  const ready = readinessIssues({ caption: post.caption, platforms: post.platforms, hasImage: !!post.imagePath }).length === 0;
  return (
    <article className={`rounded-lg border bg-white shadow-sm transition-opacity ${pending ? "opacity-60" : ""} ${overdue ? "border-rose-200" : "border-slate-200"}`}>
      <Link href={`/marketing/posts/${post.id}`} className="block rounded-t-lg p-3 hover:bg-slate-50">
        <div className="flex gap-3">
          {post.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
              <ImageIcon className="h-5 w-5" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">{post.title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{post.caption || <span className="italic text-slate-400">No caption yet</span>}</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <PlatformIcons platforms={post.platforms} className="h-3.5 w-3.5" />
          <span className={overdue ? "inline-flex items-center gap-1 font-medium text-rose-700" : ""}>
            {overdue && <AlertTriangle aria-hidden="true" className="h-3 w-3" strokeWidth={2.25} />}
            {post.scheduledLabel ?? "Not scheduled"}
            {overdue && " (date passed)"}
          </span>
          {post.initiative && <span className="truncate">{post.initiative.name}</span>}
        </div>
        {post.event && post.autoDaysBefore && (
          <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
            <Sparkles aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="truncate">
              Auto · {autoRequestLabel(post.autoDaysBefore)} {post.event.title}
            </span>
          </p>
        )}
        {post.status === "requested" && post.reviewNote && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            <MessageSquareWarning aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="line-clamp-2">{post.reviewNote}</span>
          </p>
        )}
        {post.status === "approved" && post.approvedByName && (
          <p className="mt-2 text-xs text-emerald-800">
            Approved by {post.approvedByName}, {post.approvedLabel}
          </p>
        )}
      </Link>

      {(post.status === "waiting_approval" && isAdmin) || post.status === "requested" ? (
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-slate-100 px-3 py-2">
          {post.status === "requested" &&
            (ready ? (
              <button type="button" disabled={pending} onClick={() => move("waiting_approval")} className={buttonClass("secondary", "sm")}>
                Submit for approval
              </button>
            ) : (
              <Link href={`/marketing/posts/${post.id}`} className={buttonClass("ghost", "sm")}>
                Finish writing
              </Link>
            ))}
          {post.status === "waiting_approval" && isAdmin && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={async () => {
                  const note = await promptText({ title: `Send back "${post.title}"`, label: "What needs to change?", confirmLabel: "Send back" });
                  if (note !== null) move("requested", note);
                }}
                className={buttonClass("ghost", "sm")}
              >
                <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
                Send back
              </button>
              <button type="button" disabled={pending} onClick={() => move("approved")} className={buttonClass("primary", "sm")}>
                <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                Approve
              </button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
