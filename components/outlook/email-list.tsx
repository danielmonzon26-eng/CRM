"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ExternalLink, Paperclip } from "lucide-react";
import type { EmailItem } from "@/lib/outlook/queries";
import { ComposeEmailButton } from "./compose-email";

function counterpart(email: EmailItem): string {
  if (email.direction === "inbound") return email.fromName || email.fromEmail || "Unknown sender";
  const names = email.contacts.map((c) => c.name);
  return `To ${names.length > 0 ? names.join(", ") : email.to.join(", ")}`;
}

/** Email rows that expand to the full message, with reply and Outlook links. */
export function EmailList({
  emails,
  canSend,
  showMailbox = false,
  leadId,
  blockedReason,
  emptyText = "No email yet.",
}: {
  emails: EmailItem[];
  canSend: boolean;
  blockedReason?: string;
  showMailbox?: boolean;
  leadId?: string;
  emptyText?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (emails.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {emails.map((email) => {
        const open = openId === email.id;
        const unread = email.direction === "inbound" && !email.isRead;
        const DirectionIcon = email.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
        const replyTo = email.direction === "inbound" ? email.fromEmail : email.to[0];
        return (
          <li key={email.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : email.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  email.direction === "inbound" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
                }`}
                title={email.direction === "inbound" ? "Received" : "Sent"}
              >
                <DirectionIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`truncate text-sm ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
                    {counterpart(email)}
                  </span>
                  {unread && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Unread</span>}
                  {email.needsReply && (
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Needs reply</span>
                  )}
                  {email.hasAttachments && <Paperclip aria-label="Has attachments" className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />}
                </span>
                <span className={`block truncate text-sm ${unread ? "text-slate-900" : "text-slate-700"}`}>{email.subject}</span>
                {!open && <span className="block truncate text-xs text-slate-500">{email.preview}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                {email.sentLabel}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
              </span>
            </button>

            {open && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  <dt className="text-slate-500">From</dt>
                  <dd className="break-all">{email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail}</dd>
                  <dt className="text-slate-500">To</dt>
                  <dd className="break-all">{email.to.join(", ")}</dd>
                  {email.cc.length > 0 && (
                    <>
                      <dt className="text-slate-500">Cc</dt>
                      <dd className="break-all">{email.cc.join(", ")}</dd>
                    </>
                  )}
                  {showMailbox && (
                    <>
                      <dt className="text-slate-500">Mailbox</dt>
                      <dd className="break-all">{email.mailbox}</dd>
                    </>
                  )}
                </dl>
                {email.contacts.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {email.contacts.map((c) => (
                      <Link
                        key={c.id}
                        href={`/leads/${c.leadId}`}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        {c.name}
                        {c.companyName ? ` · ${c.companyName}` : ""}
                      </Link>
                    ))}
                  </p>
                )}
                <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-800">{email.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {email.isMine ? (
                    <ComposeEmailButton
                      canSend={canSend}
                      blockedReason={blockedReason}
                      size="sm"
                      label="Reply"
                      defaults={{ to: replyTo ?? "", leadId: leadId ?? email.contacts[0]?.leadId, replyTo: { id: email.id, subject: email.subject } }}
                    />
                  ) : (
                    replyTo && (
                      <ComposeEmailButton
                        canSend={canSend}
                        blockedReason={blockedReason}
                        size="sm"
                        label="Email them"
                        defaults={{ to: replyTo, subject: `RE: ${email.subject}`, leadId: leadId ?? email.contacts[0]?.leadId }}
                      />
                    )
                  )}
                  {email.isMine && email.webLink && (
                    <a
                      href={email.webLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      Open in Outlook
                    </a>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
