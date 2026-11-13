"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { savePost } from "@/app/actions/marketing";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { DateInput } from "@/components/ui/date-input";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";
const dayLabel = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The quick way to ask for a post: topic, copy and date, in a popup. */
export function RequestPostButton({ variant = "primary", label = "Request a post" }: { variant?: "primary" | "secondary"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant)}>
        <MessageSquarePlus className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
      {open && <RequestPostDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function RequestPostDialog({ date = "", onClose }: { date?: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();
  const [topic, setTopic] = useState("");
  const [copy, setCopy] = useState("");
  const [day, setDay] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="request-post-title"
      className="animate-pop m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await savePost({
              id: null,
              title: topic,
              caption: copy,
              initiativeId: null,
              scheduledAt: day ? `${day}T09:00` : "",
              channelIds: [],
              intent: "save",
            }).catch(() => ({ error: "That didn't save. Please try again.", id: undefined }));
            if (result.error) return setError(result.error);
            toast(day ? `Post requested for ${dayLabel.format(new Date(`${day}T00:00:00Z`))}.` : "Post requested.");
            ref.current?.close();
            router.refresh();
          });
        }}
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="request-post-title" className="text-lg font-semibold text-slate-900">
              Request a post
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Say what it&apos;s about. Channels, images and the exact time can be added later.</p>
          </div>
          <label className={LABEL}>
            Topic <span className="text-brand-600">*</span>
            <input
              required
              autoFocus
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Workshop recap with photos"
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Copy
            <textarea
              rows={4}
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              placeholder="A rough draft or key points. Optional."
              className={`${FIELD} resize-y`}
            />
          </label>
          <label className={LABEL}>
            Date
            <DateInput value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
            <span className="mt-1 block text-xs font-normal text-slate-500">Optional. It&apos;s set for 9:00 a.m.; change the time when writing it.</span>
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <Link href="/marketing/posts/new" onClick={() => ref.current?.close()} className="text-sm font-medium text-slate-600 hover:text-brand-700 hover:underline">
            Write the full post instead
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button type="submit" disabled={pending || !topic.trim()} className={buttonClass("primary")}>
              {pending ? "Requesting..." : "Request post"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
