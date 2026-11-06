"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, FileText, Trash2, Upload } from "lucide-react";
import {
  addEventVideo,
  duplicateEvent,
  removeEventResource,
  setEventsArchived,
  setEventStatus,
  setRegistrationCancelled,
  setRegistrationCheckedIn,
} from "@/app/actions/events";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { useDismiss } from "@/components/ui/use-dismiss";
import { uploadEventDocument } from "@/lib/events/upload";
import type { EventStatus, RegistrationStatus } from "@/lib/supabase/types";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`${buttonClass("secondary", "sm")} shrink-0`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {copied ? "Copied" : label}
    </button>
  );
}

export function EventActionsMenu({
  eventId,
  slug,
  status,
  archived,
}: {
  eventId: string;
  slug: string;
  status: EventStatus;
  archived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const [isPending, startTransition] = useTransition();
  const { toast, confirm } = useFeedback();

  const run = (action: () => Promise<{ error?: string; id?: string }>, then?: (id?: string) => void) => {
    close();
    startTransition(async () => {
      const result = await action();
      if (result.error) toast(result.error, "error");
      else then?.(result.id);
    });
  };
  const item = "block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
      >
        Actions
        <ChevronDown className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" className="animate-pop absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-popover">
          <a role="menuitem" href={`/register/${slug}`} target="_blank" rel="noreferrer" onClick={close} className={item}>View landing page</a>
          <Link role="menuitem" href={`/events/${eventId}/edit`} onClick={close} className={item}>Edit details</Link>
          <button role="menuitem" type="button" onClick={() => run(() => duplicateEvent(eventId), (id) => router.push(`/events/${id}/edit`))} className={item}>
            Duplicate event
          </button>
          {status !== "published" && (
            <button role="menuitem" type="button" onClick={() => run(() => setEventStatus(eventId, "published"), () => toast("Event published"))} className={item}>
              {status === "cancelled" ? "Restore and publish" : "Publish"}
            </button>
          )}
          {status === "published" && (
            <button role="menuitem" type="button" onClick={() => run(() => setEventStatus(eventId, "draft"), () => toast("Event unpublished"))} className={item}>
              Unpublish
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => run(() => setEventsArchived([eventId], !archived), () => toast(archived ? "Event restored" : "Event archived"))} className={item}>
            {archived ? "Restore from archive" : "Archive"}
          </button>
          {status !== "cancelled" && (
            <button
              role="menuitem"
              type="button"
              onClick={async () => {
                close();
                const yes = await confirm({
                  title: "Cancel this event?",
                  body: "The landing page will say it's cancelled, and registrants aren't notified automatically.",
                  confirmLabel: "Cancel event",
                  danger: true,
                });
                if (yes) run(() => setEventStatus(eventId, "cancelled"), () => toast("Event cancelled"));
              }}
              className={`${item} text-rose-700`}
            >
              Cancel event
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RegistrationActions({
  registrationId,
  eventId,
  status,
  checkedIn,
}: {
  registrationId: string;
  eventId: string;
  status: RegistrationStatus;
  checkedIn: boolean;
}) {
  const cancelled = status === "cancelled";
  const [shownCheckedIn, setShownCheckedIn] = useOptimistic(checkedIn);
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      {status === "registered" && (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              // Shows the new state immediately. React restores the old one if this fails.
              setShownCheckedIn(!checkedIn);
              try {
                await setRegistrationCheckedIn(registrationId, eventId, !checkedIn);
              } catch {
                toast("That check-in didn't save. Please try again.", "error");
              }
            })
          }
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            shownCheckedIn ? "bg-emerald-50 text-emerald-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {shownCheckedIn ? "Checked in" : "Check in"}
        </button>
      )}
      {status === "waitlisted" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => setRegistrationCancelled(registrationId, eventId, false))}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Move to registered
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => setRegistrationCancelled(registrationId, eventId, !cancelled))}
        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        {cancelled ? "Restore" : "Cancel"}
      </button>
    </div>
  );
}

export function DocumentUpload({ eventId, onUploaded }: { eventId: string; onUploaded?: (name: string) => void }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setIsUploading(true);
    const uploadError = await uploadEventDocument(eventId, file);
    if (uploadError) {
      setError(uploadError);
    } else {
      onUploaded?.(file.name);
      router.refresh();
    }
    setIsUploading(false);
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 ${
          isUploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Upload className="h-3.5 w-3.5" strokeWidth={2} />
        {isUploading ? "Uploading..." : "Upload materials"}
        <input
          type="file"
          className="sr-only"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function DocumentRow({
  id,
  eventId,
  title,
  downloadUrl,
}: {
  id: string;
  eventId: string;
  title: string;
  downloadUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-card">
      <FileText className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
      {downloadUrl ? (
        <a href={downloadUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-600 hover:underline">
          {title}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-slate-500">{title}</span>
      )}
      <RemoveResourceButton id={id} eventId={eventId} label={title} />
    </div>
  );
}

export function RemoveResourceButton({ id, eventId, label }: { id: string; eventId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={`Remove ${label}`}
      onClick={async () => {
        if (!(await confirm({ title: `Remove "${label}"?`, confirmLabel: "Remove", danger: true }))) return;
        startTransition(async () => {
          try {
            await removeEventResource(id, eventId);
            toast("Removed");
          } catch {
            toast(`"${label}" couldn't be removed. Please try again.`, "error");
          }
        });
      }}
      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

export function VideoForm({ eventId, onAdded }: { eventId: string; onAdded?: (url: string) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addEventVideo(eventId, title, url);
          if (result.error) {
            setError(result.error);
          } else {
            onAdded?.(url.trim());
            setTitle("");
            setUrl("");
          }
        });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200 sm:w-48"
      />
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="YouTube, Vimeo, or other video link"
        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add video"}
      </button>
      {error && <p className="text-xs text-rose-600 sm:self-center">{error}</p>}
    </form>
  );
}
