"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Reply } from "lucide-react";
import { sendOutlookEmail } from "@/app/actions/outlook";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

export type ComposeDefaults = {
  to?: string;
  subject?: string;
  leadId?: string;
  /** Replies in the thread of this stored email; the subject is kept as "RE: ...". */
  replyTo?: { id: string; subject: string };
};

/**
 * Opens a compose box that sends from the signed-in user's own Outlook. Disabled with a
 * reason when they haven't connected one.
 */
export function ComposeEmailButton({
  defaults,
  canSend,
  blockedReason,
  label = "Email",
  size = "md",
  variant = "secondary",
}: {
  defaults: ComposeDefaults;
  canSend: boolean;
  /** Disables sending with this explanation, e.g. for a Do Not Contact company. */
  blockedReason?: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const Icon = defaults.replyTo ? Reply : Mail;
  return (
    <>
      <button
        type="button"
        disabled={!canSend || Boolean(blockedReason)}
        title={blockedReason ?? (canSend ? undefined : "Connect your Outlook on the Communication page to send email.")}
        onClick={() => setOpen(true)}
        className={buttonClass(variant, size)}
      >
        <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
        {label}
      </button>
      {open && <ComposeDialog defaults={defaults} onClosed={() => setOpen(false)} />}
    </>
  );
}

function ComposeDialog({ defaults, onClosed }: { defaults: ComposeDefaults; onClosed: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();
  const [to, setTo] = useState(defaults.to ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaults.subject ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const isReply = Boolean(defaults.replyTo);

  // showModal() focuses the first field, so move focus to where typing starts.
  useEffect(() => {
    ref.current?.showModal();
    (defaults.to ? bodyRef.current : toRef.current)?.focus();
  }, [defaults.to]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="compose-title"
      onClose={onClosed}
      onCancel={(e) => {
        if (sending) e.preventDefault();
      }}
      className="animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-white p-5 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startSending(async () => {
            try {
              const result = await sendOutlookEmail({
                to,
                cc,
                subject,
                body,
                leadId: defaults.leadId,
                replyToId: defaults.replyTo?.id,
              });
              if (result.error) {
                setError(result.error);
                return;
              }
              ref.current?.close();
              toast("Email sent.");
              router.refresh();
            } catch {
              setError("The email wasn't sent. Please try again.");
            }
          });
        }}
      >
        <h2 id="compose-title" className="text-lg font-semibold text-slate-900">
          {isReply ? "Reply" : "New email"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">Sends from your Outlook, so it also shows in your Sent Items.</p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          To
          <input
            ref={toRef}
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@company.com"
            autoComplete="off"
            className={FIELD}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Cc <span className="font-normal text-slate-500">(optional)</span>
          <input value={cc} onChange={(e) => setCc(e.target.value)} autoComplete="off" className={FIELD} />
        </label>
        {isReply ? (
          <p className="mt-3 text-sm text-slate-600">
            Subject: <span className="text-slate-900">RE: {defaults.replyTo!.subject}</span>
          </p>
        ) : (
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Subject
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} className={FIELD} />
          </label>
        )}
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Message
          <textarea
            ref={bodyRef}
            required
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${FIELD} resize-y`}
          />
        </label>
        {isReply && <p className="mt-1 text-xs text-slate-500">The earlier message is quoted below yours, as in Outlook.</p>}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={sending} onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={sending} className={buttonClass("primary")}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
