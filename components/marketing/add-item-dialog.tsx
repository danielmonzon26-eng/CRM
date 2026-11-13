"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { saveMarketingItem } from "@/app/actions/marketing-items";
import { SponsorField, type ItemDraft } from "@/components/marketing/planner-table";
import { buttonClass } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { useFeedback } from "@/components/ui/feedback";
import { deliveryDate, DELIVERY_TIMINGS, MARKETING_CATEGORIES, MARKETING_STREAMS, type MarketingStream } from "@/lib/budgets/marketing-items";
import type { ItemOptions } from "@/lib/marketing/items-queries";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";
const fmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Add marketing item": a button and the popup it opens. Defaults pre-fill the stream, event or line. */
export function AddMarketingItemButton({
  options,
  defaults,
  variant = "primary",
  label = "Add marketing item",
}: {
  options: ItemOptions;
  defaults?: Partial<ItemDraft>;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, variant === "secondary" ? "sm" : "md")}>
        <ListPlus className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
      {open && <AddItemDialog options={options} defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddItemDialog({ options, defaults = {}, onClose }: { options: ItemOptions; defaults?: Partial<ItemDraft>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstEvent = defaults.eventId ? options.events.find((e) => e.id === defaults.eventId) : undefined;
  const [v, setV] = useState<ItemDraft>({
    stream: "catapult",
    type: "social",
    description: "",
    eventId: null,
    sponsorId: null,
    sponsorName: "",
    amount: "",
    budgetLineId: firstEvent?.lineId ?? null,
    timing: defaults.eventId ? "2_weeks" : "custom",
    deliveryOn: "",
    status: "planned",
    ...defaults,
  });
  const set = (patch: Partial<ItemDraft>) => setV((x) => ({ ...x, ...patch }));
  const event = options.events.find((e) => e.id === v.eventId);
  const due = deliveryDate(event?.day ?? null, (v.timing as never) ?? null, v.deliveryOn || null);
  const lines = options.lines.filter((l) => !l.eventId || l.eventId === v.eventId);
  const byBudget = lines.reduce<Record<string, ItemOptions["lines"]>>((acc, l) => ((acc[l.budgetName] ??= []).push(l), acc), {});
  const eventWithoutLine = v.stream === "event" && event && !event.lineId;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="add-item-title" className="animate-pop m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await saveMarketingItem({ id: null, ...v }).catch(() => ({ error: "That didn't save. Please try again.", id: undefined }));
            if (result.error) return setError(result.error);
            toast("Marketing item added.");
            ref.current?.close();
            router.refresh();
          });
        }}
      >
        <div className="space-y-4 p-5">
          <h2 id="add-item-title" className="text-lg font-semibold text-slate-900">
            Add a marketing item
          </h2>

          <fieldset>
            <legend className={LABEL}>For</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {MARKETING_STREAMS.map(([key, label]) => (
                <label
                  key={key}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                    v.stream === key ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={v.stream === key}
                    onChange={() => set({ stream: key as MarketingStream, eventId: key === "catapult" ? null : v.eventId, sponsorId: key === "sponsorship" ? v.sponsorId : null, timing: key === "catapult" ? "custom" : v.timing })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Marketing item
              <select value={v.type} onChange={(e) => set({ type: e.target.value })} className={FIELD}>
                {MARKETING_CATEGORIES.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Amount ($)
              <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" value={v.amount} onChange={(e) => set({ amount: e.target.value })} className={FIELD} />
            </label>
          </div>

          <label className={LABEL}>
            Description
            <input value={v.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Event poster, Meta ads, photographer" className={FIELD} />
          </label>

          {v.stream === "sponsorship" && (
            <div>
              <p className={LABEL}>Sponsor</p>
              <div className="mt-1 rounded-lg border border-slate-300">
                <SponsorField value={{ id: v.sponsorId, name: v.sponsorName }} known={options.sponsors} onPick={(s) => set({ sponsorId: s.id, sponsorName: s.name })} />
              </div>
            </div>
          )}

          {v.stream !== "catapult" && (
            <label className={LABEL}>
              Event{v.stream === "sponsorship" && <span className="font-normal text-slate-500"> (optional)</span>}
              <select
                value={v.eventId ?? ""}
                onChange={(e) => {
                  const ev = options.events.find((x) => x.id === e.target.value);
                  set({ eventId: e.target.value || null, budgetLineId: ev?.lineId ?? v.budgetLineId, timing: e.target.value ? (v.timing === "custom" && !v.deliveryOn ? "2_weeks" : v.timing) : "custom" });
                }}
                className={FIELD}
              >
                <option value="">{v.stream === "event" ? "Choose the event" : "No event"}</option>
                {options.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.whenLabel} · {e.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {v.eventId ? (
              <label className={LABEL}>
                Due
                <select value={v.timing ?? ""} onChange={(e) => set({ timing: e.target.value || null })} className={FIELD}>
                  {DELIVERY_TIMINGS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {due && v.timing !== "custom" && <span className="mt-1 block text-xs font-normal text-slate-500">{fmt.format(new Date(`${due}T00:00:00Z`))}</span>}
              </label>
            ) : null}
            {(!v.eventId || v.timing === "custom") && (
              <label className={LABEL}>
                Due date
                <DateInput aria-label="Due date" value={v.deliveryOn ?? ""} onChange={(e) => set({ deliveryOn: e.target.value, timing: "custom" })} className={FIELD} />
              </label>
            )}
          </div>

          <label className={LABEL}>
            Budget line <span className="text-brand-600">*</span>
            <select required value={v.budgetLineId ?? ""} onChange={(e) => set({ budgetLineId: e.target.value || null })} className={FIELD}>
              <option value="">Choose the line that pays for it</option>
              {Object.entries(byBudget).map(([budget, ls]) => (
                <optgroup key={budget} label={budget}>
                  {ls.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.section ? ` · ${l.section}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {eventWithoutLine && (
              <span className="mt-1 block text-xs font-normal text-amber-800">
                This event has no budget line yet.{" "}
                <Link href={`/events/${event!.id}?tab=budget`} className="underline">
                  Set it up on its Budget &amp; marketing tab
                </Link>
                , or pick another line.
              </span>
            )}
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={pending || !v.budgetLineId} className={buttonClass("primary")}>
            {pending ? "Adding..." : "Add item"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
