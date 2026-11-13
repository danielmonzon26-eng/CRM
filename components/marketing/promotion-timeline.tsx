"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Megaphone, Plus, Rocket, Sparkles, Trash2, Wallet } from "lucide-react";
import { applySuggestedPromotions, deletePromotion, savePromotion, type PromotionInput } from "@/app/actions/marketing";
import { PlatformIcon } from "@/components/marketing/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { money } from "@/components/ui/dashboard";
import { useFeedback } from "@/components/ui/feedback";
import { PLATFORMS, POST_STATUS_META } from "@/lib/marketing/constants";
import type { Promotion, PromotionEvent } from "@/lib/marketing/promotion-queries";
import { addDays, dailySpend, daysBetween, PROMOTION_STATUS_META, type SuggestedPromotion } from "@/lib/marketing/promotions";
import { DateInput } from "@/components/ui/date-input";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";
const short = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const fmt = (day: string) => short.format(new Date(`${day}T00:00:00Z`));

type Editing = { event: PromotionEvent; promotion: Promotion | null };

/**
 * Paid promotion for each upcoming event, on one shared timeline: boosts and ads as bars,
 * the event's 2-week / 1-week / 1-day posts as dots, and the event day as a flag.
 */
export function PromotionTimeline({ today, start, end, events }: { today: string; start: string; end: string; events: PromotionEvent[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const span = Math.max(1, daysBetween(start, end) + 1);
  const pos = (day: string) => (Math.min(Math.max(daysBetween(start, day), 0), span) / span) * 100;
  const width = (from: string, to: string) => Math.max(((daysBetween(from, to) + 1) / span) * 100, 100 / span);
  const weeks: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(d);

  const funded = events.filter((e) => e.adBudget > 0 || e.promotions.length > 0);
  const unfunded = events.filter((e) => e.adBudget === 0 && e.promotions.length === 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The ad budget comes from each event&apos;s Budget &amp; marketing tab: costs named like <span className="font-medium">Ad spend</span>, <span className="font-medium">Ads</span>,{" "}
        <span className="font-medium">Boost</span> or <span className="font-medium">Paid social</span>.
      </p>

      {funded.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Rocket className="mx-auto h-6 w-6 text-slate-400" strokeWidth={2} />
          <p className="mt-2 font-medium text-slate-900">No ad budget on upcoming events yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Add an &quot;Ad spend&quot; cost on an event&apos;s Budget &amp; marketing tab, and a suggested boost plan shows up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="min-w-[760px]">
            {/* Week scale */}
            <div className="grid grid-cols-[260px_1fr] border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <div className="px-4 py-2 font-medium uppercase tracking-wide">Event</div>
              <div className="relative h-8">
                {weeks.map((w) => (
                  <span key={w} className="absolute top-2 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(w)}%` }}>
                    {fmt(w)}
                  </span>
                ))}
                <span aria-hidden="true" className="absolute inset-y-0 w-px bg-brand-400" style={{ left: `${pos(today)}%` }} />
              </div>
            </div>

            {funded.map((ev) => (
              <EventLane key={ev.id} event={ev} pos={pos} width={width} today={today} onEdit={(promotion) => setEditing({ event: ev, promotion })} />
            ))}
          </div>
        </div>
      )}

      {funded.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded bg-brand-500" /> Boost a post
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded bg-violet-500" /> Run an ad
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded border-2 border-dashed border-slate-400" /> Suggested, not saved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Event posts (2 weeks, 1 week, 1 day)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flag aria-hidden="true" className="h-3 w-3 text-rose-600" strokeWidth={2.5} /> Event day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-px bg-brand-400" /> Today
          </span>
        </p>
      )}

      {unfunded.length > 0 && (
        <section aria-labelledby="unfunded-title" className="rounded-xl border border-slate-200 bg-white shadow-card">
          <h2 id="unfunded-title" className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">
            Upcoming events with no ad budget ({unfunded.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {unfunded.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{ev.title}</span> <span className="text-slate-500">· {ev.whenLabel}</span>
                </span>
                <Link href={`/events/${ev.id}?tab=budget`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
                  Add ad budget
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <PromotionDialog event={editing.event} promotion={editing.promotion} today={today} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EventLane({
  event,
  pos,
  width,
  today,
  onEdit,
}: {
  event: PromotionEvent;
  pos: (day: string) => number;
  width: (from: string, to: string) => number;
  today: string;
  onEdit: (promotion: Promotion | null) => void;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const rows: (Promotion | SuggestedPromotion)[] = event.promotions.length ? event.promotions : event.suggestions;
  const left = event.adBudget - event.planned;
  const over = event.planned > event.adBudget && event.adBudget > 0;

  return (
    <div className="grid grid-cols-[260px_1fr] border-b border-slate-100 last:border-b-0">
      <div className="space-y-1.5 border-r border-slate-100 px-4 py-3">
        <Link href={`/events/${event.id}`} className="block font-medium leading-snug text-slate-900 hover:text-brand-700 hover:underline">
          {event.title}
        </Link>
        <p className="text-xs text-slate-500">{event.whenLabel}</p>
        <p className="text-xs text-slate-600">
          <Link href={`/events/${event.id}?tab=budget`} className="font-medium text-slate-800 hover:text-brand-700 hover:underline" title={event.adItems.map((i) => `${i.name}: ${money(i.amount)}`).join(", ")}>
            {money(event.adBudget)} ad budget
          </Link>
          {event.promotions.length > 0 && (
            <>
              {" · "}
              <span className={over ? "font-medium text-rose-700" : ""}>{money(event.planned)} planned</span>
              {" · "}
              {money(event.spent)} spent
            </>
          )}
        </p>
        {event.promotions.length > 0 && event.adBudget > 0 && (
          <p className={`text-xs ${over ? "font-medium text-rose-700" : left > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {over ? `${money(-left)} over the ad budget` : left > 0 ? `${money(left)} not planned yet` : "Budget fully planned"}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {event.promotions.length === 0 && event.suggestions.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await applySuggestedPromotions(event.id).catch(() => ({ error: "That didn't save. Please try again." }));
                  if (result.error) toast(result.error, "error");
                  else {
                    toast("Plan saved. Click a bar to change it.");
                    router.refresh();
                  }
                })
              }
              className={buttonClass("primary", "sm")}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              {pending ? "Saving..." : "Use this plan"}
            </button>
          )}
          <button type="button" onClick={() => onEdit(null)} className={buttonClass("secondary", "sm")}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add
          </button>
        </div>
      </div>

      <div className="relative min-h-[96px] py-3">
        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-brand-200" style={{ left: `${pos(today)}%` }} />
        <span className="absolute top-1 -translate-x-1/2 text-rose-600" style={{ left: `${pos(event.day)}%` }} title={`Event day, ${fmt(event.day)}`}>
          <Flag className="h-4 w-4" strokeWidth={2.5} />
          <span className="sr-only">Event day {fmt(event.day)}</span>
        </span>
        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-rose-200" style={{ left: `${pos(event.day)}%` }} />

        {/* The event's own posts */}
        <div className="relative h-5">
          {event.markers.map((m) => (
            <Link
              key={m.postId}
              href={`/marketing/posts/${m.postId}`}
              title={`${m.title} · ${POST_STATUS_META[m.status].label} · ${fmt(m.day)}`}
              className={`absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-white hover:scale-125 ${POST_STATUS_META[m.status].dot}`}
              style={{ left: `${pos(m.day)}%` }}
            >
              <span className="sr-only">
                {m.title}, {fmt(m.day)}
              </span>
            </Link>
          ))}
        </div>

        <ul className="mt-1 space-y-1.5 pr-2">
          {rows.map((r, i) => {
            const saved = "id" in r;
            const daily = dailySpend(r.amount, r.startsOn, r.endsOn);
            const label = `${r.name} · ${fmt(r.startsOn)}–${fmt(r.endsOn)} · ${money(r.amount)} (${money(daily)}/day)`;
            const tone = r.kind === "boost" ? "bg-brand-500 text-white" : "bg-violet-500 text-white";
            const style = { left: `${pos(r.startsOn)}%`, width: `${width(r.startsOn, r.endsOn)}%` };
            return (
              <li key={saved ? r.id : `s${i}`} className="relative h-7">
                {saved ? (
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    title={label}
                    className={`absolute flex h-7 min-w-[28px] items-center gap-1 overflow-hidden rounded-md px-2 text-left text-[11px] font-medium shadow-sm hover:ring-2 hover:ring-brand-200 ${
                      r.status === "done" ? "bg-slate-300 text-slate-700" : tone
                    } ${r.status === "planned" ? "opacity-80" : ""}`}
                    style={style}
                  >
                    {r.kind === "boost" ? <Rocket aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.25} /> : <Megaphone aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.25} />}
                    <span className="truncate">
                      {money(r.amount)} · {r.name}
                    </span>
                    <span className="sr-only">, {PROMOTION_STATUS_META[r.status].label}</span>
                  </button>
                ) : (
                  <span
                    title={`Suggested: ${label}`}
                    className="absolute flex h-7 min-w-[28px] items-center gap-1 overflow-hidden rounded-md border-2 border-dashed border-slate-400 bg-slate-50 px-2 text-[11px] font-medium text-slate-700"
                    style={style}
                  >
                    <span className="truncate">
                      {money(r.amount)} · {r.name} · {money(daily)}/day
                    </span>
                  </span>
                )}
              </li>
            );
          })}
          {rows.length === 0 && <li className="px-2 text-xs text-slate-500">Nothing planned. Use Add to plan a boost or an ad.</li>}
        </ul>
      </div>
    </div>
  );
}

function PromotionDialog({ event, promotion, today, onClose }: { event: PromotionEvent; promotion: Promotion | null; today: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Omit<PromotionInput, "id" | "eventId">>(() =>
    promotion
      ? {
          kind: promotion.kind,
          name: promotion.name,
          postId: promotion.postId,
          platforms: promotion.platforms,
          startsOn: promotion.startsOn,
          endsOn: promotion.endsOn,
          amount: String(promotion.amount),
          spent: promotion.spent ? String(promotion.spent) : "",
          status: promotion.status,
        }
      : {
          kind: "ad",
          name: "Ad: ",
          postId: null,
          platforms: ["facebook", "instagram"],
          startsOn: today,
          endsOn: addDays(event.day, -1) < today ? today : addDays(event.day, -1),
          amount: event.adBudget > event.planned ? String(Math.round(event.adBudget - event.planned)) : "",
          spent: "",
          status: "planned",
        },
  );
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const daily = v.startsOn && v.endsOn && v.endsOn >= v.startsOn ? dailySpend(Number(v.amount) || 0, v.startsOn, v.endsOn) : null;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePromotion({ id: promotion?.id ?? null, eventId: event.id, ...v }).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) return setError(result.error);
      toast(promotion ? "Saved." : "Added to the plan.");
      ref.current?.close();
      router.refresh();
    });
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="promo-title" className="animate-pop m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="promo-title" className="text-lg font-semibold text-slate-900">
              {promotion ? "Edit promotion" : "Add a boost or ad"}
            </h2>
            <p className="text-sm text-slate-500">
              {event.title} · {event.whenLabel} · {money(event.adBudget)} ad budget
            </p>
          </div>

          <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
            {(
              [
                ["boost", "Boost a post", Rocket],
                ["ad", "Run an ad", Megaphone],
              ] as const
            ).map(([key, label, Icon]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  v.kind === key ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                <input type="radio" name="kind" className="sr-only" checked={v.kind === key} onChange={() => set({ kind: key, postId: key === "ad" ? null : v.postId })} />
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </label>
            ))}
          </div>

          {v.kind === "boost" && (
            <label className={LABEL}>
              Post to boost
              <select value={v.postId ?? ""} onChange={(e) => set({ postId: e.target.value || null })} className={FIELD}>
                <option value="">Choose a post</option>
                {event.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={LABEL}>
            Name
            <input required maxLength={200} value={v.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
          </label>

          <fieldset>
            <legend className={LABEL}>Where</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = v.platforms.includes(p.key);
                return (
                  <label key={p.key} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ platforms: on ? v.platforms.filter((x) => x !== p.key) : [...v.platforms, p.key] })} />
                    <PlatformIcon platform={p.key} className="h-3.5 w-3.5" title="" />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Starts
              <DateInput required value={v.startsOn} onChange={(e) => set({ startsOn: e.target.value })} className={FIELD} />
            </label>
            <label className={LABEL}>
              Ends
              <DateInput required min={v.startsOn} value={v.endsOn} onChange={(e) => set({ endsOn: e.target.value })} className={FIELD} />
            </label>
            <label className={LABEL}>
              Budget ($)
              <input type="number" min={0} step="any" inputMode="decimal" value={v.amount} onChange={(e) => set({ amount: e.target.value })} className={FIELD} />
              {daily !== null && <span className="mt-1 block text-xs font-normal text-slate-500">{money(daily)} a day</span>}
            </label>
            <label className={LABEL}>
              Spent so far ($)
              <input type="number" min={0} step="any" inputMode="decimal" value={v.spent} onChange={(e) => set({ spent: e.target.value })} placeholder="0" className={FIELD} />
            </label>
          </div>

          <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">
            {(["planned", "running", "done"] as const).map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  v.status === s ? `border-current font-medium ${PROMOTION_STATUS_META[s].pill}` : "border-slate-300 text-slate-700"
                }`}
              >
                <input type="radio" name="status" className="sr-only" checked={v.status === s} onChange={() => set({ status: s })} />
                {PROMOTION_STATUS_META[s].label}
              </label>
            ))}
          </div>

          <p className="text-xs text-slate-500">Record the actual charge under Budgets too, so the event&apos;s budget shows it.</p>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          {promotion ? (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!(await confirm({ title: `Delete "${promotion.name}"?`, confirmLabel: "Delete", danger: true }))) return;
                startTransition(async () => {
                  const result = await deletePromotion(promotion.id).catch(() => ({ error: "That wasn't deleted. Please try again." }));
                  if (result.error) return setError(result.error);
                  toast("Deleted.");
                  ref.current?.close();
                  router.refresh();
                });
              }}
              className={`${buttonClass("ghost")} text-rose-700 hover:bg-rose-50`}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "Saving..." : promotion ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

