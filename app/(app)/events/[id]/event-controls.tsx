"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileText, Trash2, Upload } from "lucide-react";
import {
  addEventVideo,
  removeEventResource,
  setEventStatus,
  setRegistrationCancelled,
  setRegistrationCheckedIn,
} from "@/app/actions/events";
import { uploadEventDocument } from "@/lib/events/upload";
import type { EventStatus, RegistrationStatus } from "@/lib/supabase/types";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function EventStatusButtons({ eventId, status }: { eventId: string; status: EventStatus }) {
  const [isPending, startTransition] = useTransition();
  const change = (next: EventStatus) =>
    startTransition(async () => {
      const result = await setEventStatus(eventId, next);
      if (result.error) alert(result.error);
    });

  return (
    <>
      {status !== "published" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => change("published")}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === "cancelled" ? "Restore and publish" : "Publish"}
        </button>
      )}
      {status === "published" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => change("draft")}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Unpublish
        </button>
      )}
      {status !== "cancelled" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (confirm("Cancel this event? The registration page will say it's cancelled.")) change("cancelled");
          }}
          className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Cancel event
        </button>
      )}
    </>
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
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      {status === "registered" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => setRegistrationCheckedIn(registrationId, eventId, !checkedIn))}
          className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            checkedIn ? "bg-emerald-50 text-emerald-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {checkedIn ? "Checked in" : "Check in"}
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
  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={`Remove ${label}`}
      onClick={() => {
        if (confirm(`Remove "${label}"?`)) startTransition(() => removeEventResource(id, eventId));
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
