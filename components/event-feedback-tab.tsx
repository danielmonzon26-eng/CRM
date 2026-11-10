"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, MailCheck, MessageSquareText, RotateCcw, Send, Star, ThumbsUp, Users, X } from "lucide-react";
import { feedbackLinks, listFeedbackMailboxes, prepareFeedbackRequests, retryFailedFeedback, sendFeedbackBatch, type Audience } from "@/app/actions/feedback";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { downloadCsv } from "@/lib/csv";
import { FOLLOW_UP_LABELS, TOPIC_LABELS, type FeedbackResponse, type FeedbackSummary } from "@/lib/events/feedback";

const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

function scoreTone(value: number) {
  return value >= 9 ? "bg-emerald-500" : value >= 7 ? "bg-sky-500" : value >= 5 ? "bg-amber-400" : "bg-rose-400";
}

export function EventFeedbackTab({
  eventId,
  eventTitle,
  eventOver,
  summary,
  registeredCount,
  attendedCount,
}: {
  eventId: string;
  eventTitle: string;
  eventOver: boolean;
  summary: FeedbackSummary;
  registeredCount: number;
  attendedCount: number;
}) {
  const [open, setOpen] = useState<FeedbackResponse | null>(null);
  const { responses } = summary;

  return (
    <div className="space-y-5">
      <RequestPanel eventId={eventId} eventTitle={eventTitle} eventOver={eventOver} summary={summary} registeredCount={registeredCount} attendedCount={attendedCount} />

      <section aria-label="Scores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={MessageSquareText} label="Responses" value={String(responses.length)} detail={summary.responseRate !== null ? `${summary.responseRate}% of ${summary.sentCount} asked` : "No requests sent yet"} />
        <Metric icon={Star} label="Satisfaction" value={summary.avgSatisfaction !== null ? `${summary.avgSatisfaction} / 10` : "—"} detail="Average score" />
        <Metric icon={ThumbsUp} label="Would recommend" value={summary.avgRecommend !== null ? `${summary.avgRecommend} / 10` : "—"} detail="Average score" />
        <Metric
          icon={Users}
          label="Net Promoter Score"
          value={summary.nps !== null ? `${summary.nps > 0 ? "+" : ""}${summary.nps}` : "—"}
          detail="% giving 9-10 minus % giving 1-6"
          tone={summary.nps === null ? undefined : summary.nps >= 30 ? "text-emerald-700" : summary.nps >= 0 ? "text-sky-700" : "text-rose-700"}
        />
      </section>

      {responses.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Distribution title="How satisfied were they?" counts={summary.satisfactionCounts} />
          <Distribution title="How likely to recommend?" counts={summary.recommendCounts} />
        </div>
      )}

      {responses.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={`${CARD} p-5`}>
            <h2 className="font-semibold text-slate-900">Topics they want next</h2>
            <ul className="mt-3 space-y-2">
              {summary.topicCounts.map((t) => (
                <li key={t.key} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-700">{t.label}</span>
                    <span className="tabular-nums text-slate-900">{t.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${responses.length ? (t.count / responses.length) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className={`${CARD} p-5`}>
            <h2 className="font-semibold text-slate-900">Asked for a follow-up ({summary.followUps.length})</h2>
            {summary.followUps.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nobody yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {summary.followUps.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{r.name ?? r.email}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {FOLLOW_UP_LABELS[r.followUp ?? ""]} · {r.email}
                      </span>
                    </span>
                    {r.leadId ? (
                      <Link href={`/leads/${r.leadId}`} className={buttonClass("secondary", "sm")}>
                        Open lead
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className={CARD}>
        <h2 className="border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900">Responses ({responses.length})</h2>
        {responses.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No responses yet. They appear here as people fill in the form.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Satisfied</th>
                  <th scope="col" className="px-3 py-2 font-medium">Recommend</th>
                  <th scope="col" className="px-3 py-2 font-medium">Follow-up</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sent in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {responses.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(r)}>
                    <td className="px-5 py-2.5">
                      <button type="button" onClick={() => setOpen(r)} className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {r.name ?? r.email ?? "Anonymous"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5"><ScoreChip value={r.satisfaction} /></td>
                    <td className="px-3 py-2.5"><ScoreChip value={r.recommend} /></td>
                    <td className="px-3 py-2.5 text-slate-600">{r.followUp ? FOLLOW_UP_LABELS[r.followUp] : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{r.submittedLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && <ResponseDialog response={open} onClosed={() => setOpen(null)} />}
    </div>
  );
}

function RequestPanel({
  eventId,
  eventTitle,
  eventOver,
  summary,
  registeredCount,
  attendedCount,
}: {
  eventId: string;
  eventTitle: string;
  eventOver: boolean;
  summary: FeedbackSummary;
  registeredCount: number;
  attendedCount: number;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [audience, setAudience] = useState<Audience>(attendedCount > 0 ? "attended" : "registered");
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; name: string | null }[] | null>(null);
  const [mailbox, setMailbox] = useState("");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);

  useEffect(() => {
    listFeedbackMailboxes()
      .then((list) => {
        setMailboxes(list);
        setMailbox(list[0]?.id ?? "");
      })
      .catch(() => setMailboxes([]));
  }, []);

  const notYetSent = Math.max(0, summary.requested - summary.sentCount - summary.failedCount);

  async function send() {
    setBusy(true);
    stop.current = false;
    try {
      const prepared = await prepareFeedbackRequests(eventId, audience);
      if (prepared.error) {
        toast(prepared.error, "error");
        return;
      }
      let sent = 0;
      let failed = 0;
      let remaining = Number.POSITIVE_INFINITY;
      setProgress({ sent: 0, total: prepared.total ?? 0 });
      while (remaining > 0 && !stop.current) {
        const batch = await sendFeedbackBatch(eventId, mailbox);
        if (batch.error) {
          toast(batch.error, "error");
          break;
        }
        sent += batch.sent ?? 0;
        failed += batch.failed ?? 0;
        remaining = batch.remaining ?? 0;
        setProgress({ sent, total: sent + remaining });
        if ((batch.sent ?? 0) + (batch.failed ?? 0) === 0) break;
      }
      toast(failed ? `Sent ${sent}. ${failed} couldn't be sent; you can retry them.` : `Feedback requests sent to ${sent} ${sent === 1 ? "person" : "people"}.`);
    } catch {
      toast("Sending stopped. Please try again; nobody gets a second email.", "error");
    } finally {
      setBusy(false);
      setProgress(null);
      router.refresh();
    }
  }

  async function downloadLinks() {
    const prepared = await prepareFeedbackRequests(eventId, audience).catch(() => ({ error: "That didn't work." }));
    if (prepared.error) {
      toast(prepared.error, "error");
      return;
    }
    const result = await feedbackLinks(eventId).catch(() => ({ error: "The links didn't load.", rows: undefined }));
    if (!result.rows) {
      toast(result.error ?? "The links didn't load.", "error");
      return;
    }
    downloadCsv(`${eventTitle} feedback links.csv`, [["Name", "Email", "Feedback link", "Status"], ...result.rows]);
    router.refresh();
  }

  const noMailbox = mailboxes !== null && mailboxes.length === 0;

  return (
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Request feedback</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {summary.requested > 0
              ? `Sent to ${summary.sentCount} of ${summary.requested}. ${summary.responses.length} responded.`
              : "Each person gets a short email with their own link to a 2-minute form."}
          </p>
          {!eventOver && <p className="mt-1 text-xs text-amber-800">This event hasn&apos;t finished yet. Feedback is best sent the day after.</p>}
        </div>
        {summary.requested > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            <MailCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {summary.responseRate ?? 0}% response rate
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Who to ask</legend>
          <div className="mt-1.5 space-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" checked={audience === "attended"} disabled={attendedCount === 0} onChange={() => setAudience("attended")} className="accent-brand-600" />
              People who checked in <span className="text-slate-500">({attendedCount})</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" checked={audience === "registered"} onChange={() => setAudience("registered")} className="accent-brand-600" />
              Everyone registered <span className="text-slate-500">({registeredCount})</span>
            </label>
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-slate-700">
          Send from
          {mailboxes === null ? (
            <p className="mt-1.5 font-normal text-slate-500">Checking mailboxes...</p>
          ) : noMailbox ? (
            <p className="mt-1.5 font-normal text-slate-600">
              No Outlook mailbox is connected yet.{" "}
              <Link href="/communication" className="text-brand-700 hover:underline">
                Connect one
              </Link>
              , or download the links for a mail merge.
            </p>
          ) : (
            <select value={mailbox} onChange={(e) => setMailbox(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ? `${m.name} (${m.email})` : m.email}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {progress && (
        <div className="mt-4" role="status">
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              Sending {progress.sent} of {progress.total}... keep this page open.
            </span>
            <button type="button" onClick={() => (stop.current = true)} className="font-medium text-slate-700 hover:underline">
              Pause
            </button>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${progress.total ? (progress.sent / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!noMailbox && (
          <button type="button" disabled={busy || !mailbox} onClick={() => void send()} className={buttonClass("primary")}>
            <Send className="h-4 w-4" strokeWidth={2} />
            {busy ? "Sending..." : summary.requested === 0 ? "Send feedback requests" : notYetSent > 0 ? `Send to the remaining ${notYetSent}` : "Send to anyone new"}
          </button>
        )}
        {summary.failedCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await retryFailedFeedback(eventId).catch(() => ({ error: "That didn't work." }));
              if (result.error) toast(result.error, "error");
              else {
                toast(`${summary.failedCount} ready to retry. Press Send to send them.`);
                router.refresh();
              }
            }}
            className={buttonClass("secondary")}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Retry {summary.failedCount} that failed
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void downloadLinks()} className={buttonClass(noMailbox ? "primary" : "secondary")}>
          <Download className="h-4 w-4" strokeWidth={2} />
          Download links (CSV)
        </button>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Star; label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone ?? "text-slate-900"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Distribution({ title, counts }: { title: string; counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <section className={`${CARD} p-5`}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label={`${title}: ${counts.map((c, i) => `${i + 1}: ${c}`).join(", ")}`}>
        {counts.map((count, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end text-center">
            <span className="text-[11px] tabular-nums text-slate-600">{count || ""}</span>
            <div className={`mt-0.5 rounded-t ${count ? scoreTone(i + 1) : "bg-slate-100"}`} style={{ height: `${count ? Math.max(6, (count / max) * 100) : 4}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[11px] text-slate-500">
        {counts.map((_, i) => (
          <span key={i} className="flex-1">
            {i + 1}
          </span>
        ))}
      </div>
    </section>
  );
}

function ScoreChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-900">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${scoreTone(value)}`} />
      {value}
    </span>
  );
}

function ResponseDialog({ response, onClosed }: { response: FeedbackResponse; onClosed: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="response-title"
      onClose={onClosed}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="response-title" className="text-lg font-semibold text-slate-900">{response.name ?? "Response"}</h2>
          <p className="text-sm text-slate-500">
            {response.email} · {response.submittedLabel}
          </p>
        </div>
        <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <dl className="space-y-4 px-5 py-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Satisfied</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{response.satisfaction} / 10</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Would recommend</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{response.recommend} / 10</dd>
          </div>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Topics for future events</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {response.topics.length ? (
              response.topics.map((t) => (
                <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                  {TOPIC_LABELS[t] ?? t}
                </span>
              ))
            ) : (
              <span className="text-slate-500">None chosen</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Most valuable</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-800">{response.mostValuable ?? <span className="text-slate-500">No answer</span>}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Could do better</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-800">{response.improve ?? <span className="text-slate-500">No answer</span>}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Follow-up</dt>
          <dd className="mt-1 text-slate-800">{response.followUp ? FOLLOW_UP_LABELS[response.followUp] : "No answer"}</dd>
        </div>
      </dl>
      {response.leadId && (
        <div className="border-t border-slate-100 px-5 py-3 text-right">
          <Link href={`/leads/${response.leadId}`} className={buttonClass("secondary", "sm")}>
            Open lead
          </Link>
        </div>
      )}
    </dialog>
  );
}
