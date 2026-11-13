"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { deleteMarketingItem, duplicateMarketingItem, saveMarketingItem, searchSponsors, type MarketingItemInput } from "@/app/actions/marketing-items";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { money } from "@/components/ui/dashboard";
import { useFeedback } from "@/components/ui/feedback";
import {
  deliveryDate,
  DELIVERY_TIMINGS,
  MARKETING_CATEGORIES,
  MARKETING_CATEGORY_LABELS,
  MARKETING_CATEGORY_STYLES,
  MARKETING_STATUSES,
  MARKETING_STATUS_STYLES,
  MARKETING_STREAMS,
  MARKETING_STREAM_STYLES,
  type MarketingStream,
} from "@/lib/budgets/marketing-items";
import type { ItemOptions, MarketingItem } from "@/lib/marketing/items-queries";
import type { PostItem } from "@/lib/marketing/queries";
import { DateInput } from "@/components/ui/date-input";

/** Every editable cell is the same box: white, a light border, a stronger one on hover. */
const CELL =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
/** Dropdowns that carry a colour (stream, item, status): the same box, tinted. */
const PILL_CELL =
  "h-9 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
/** A read-only cell (social posts): the same size as the boxes, without the border. */
const READ_CELL = "flex h-9 w-full items-center rounded-md px-2 text-sm";
const dueFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (day: string | null) => (day ? dueFormat.format(new Date(`${day}T00:00:00Z`)) : "—");

type Row = { kind: "item"; item: MarketingItem } | { kind: "post"; post: PostItem } | { kind: "new"; key: string };

export type ItemDraft = Omit<MarketingItemInput, "id" | "assignedTo"> & { sponsorName: string; assignedTo: string | null };
type Draft = ItemDraft;

function draftOf(item: MarketingItem | null, options: ItemOptions, defaults: Partial<Draft> = {}): Draft {
  if (!item) {
    const base: Draft = { stream: "catapult", type: "social", description: "", eventId: null, sponsorId: null, sponsorName: "", amount: "", budgetLineId: null, timing: "custom", deliveryOn: "", status: "planned", assignedTo: null };
    const d = { ...base, ...defaults };
    // An event item starts on the event's own budget line and "2 weeks before".
    const ev = d.eventId ? options.events.find((e) => e.id === d.eventId) : undefined;
    return { ...d, budgetLineId: d.budgetLineId ?? ev?.lineId ?? null, timing: d.eventId && !defaults.timing ? "2_weeks" : d.timing };
  }
  return {
    stream: item.stream,
    type: item.type,
    description: item.description,
    eventId: item.event?.id ?? null,
    sponsorId: item.sponsor?.id ?? null,
    sponsorName: item.sponsor?.name ?? "",
    amount: item.amount ? String(item.amount) : "",
    budgetLineId: item.budgetLine?.id ?? null,
    timing: item.timing,
    deliveryOn: item.deliveryOn ?? "",
    status: item.status,
    assignedTo: item.assigneeId,
  };
  void options;
}

/**
 * The planner as one editable list: every marketing item (Catapult, Event, Sponsorship)
 * and every social post, sorted by when it's due. Item cells save as you change them.
 */
export function PlannerTable({ items, posts, options, today }: { items: MarketingItem[]; posts: PostItem[]; options: ItemOptions; today: string }) {
  const [stream, setStream] = useState<MarketingStream | "all">("all");
  const [types, setTypes] = useState<string[]>([]);
  const [source, setSource] = useState<"all" | "items" | "posts">("all");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const itemRows: Row[] = source === "posts" ? [] : items
      .filter((i) => (stream === "all" || i.stream === stream) && (types.length === 0 || types.includes(i.type)) && (showDone || i.status !== "done"))
      .filter((i) => !q || [i.name, i.event?.title, i.sponsor?.name, i.budgetLine?.name].some((v) => v?.toLowerCase().includes(q)))
      .map((item) => ({ kind: "item", item }));
    const postStream = (p: PostItem): MarketingStream => (p.event ? "event" : "catapult");
    const postRows: Row[] = source === "items" ? [] : posts
      .filter((p) => (stream === "all" || postStream(p) === stream) && (types.length === 0 || types.includes("social")) && (showDone || !p.isPast))
      .filter((p) => !q || [p.title, p.event?.title, p.initiative?.name].some((v) => v?.toLowerCase().includes(q)))
      .map((post) => ({ kind: "post", post }));
    const due = (r: Row) => (r.kind === "item" ? r.item.due : r.kind === "post" ? r.post.dayKey : null) ?? "9999";
    return [...itemRows, ...postRows].sort((a, b) => due(a).localeCompare(due(b)));
  }, [items, posts, stream, types, source, showDone, query]);

  const totals = useMemo(() => {
    const shown = items.filter((i) => stream === "all" || i.stream === stream);
    return { amount: shown.reduce((s, i) => s + i.amount, 0), unbudgeted: shown.filter((i) => i.amount > 0 && !i.budgetLine).length };
  }, [items, stream]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Stream (click again to show all)" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {MARKETING_STREAMS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={stream === key}
              title={stream === key ? "Show every stream" : `Show ${label} only`}
              onClick={() => setStream(stream === key ? "all" : key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${stream === key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by item">
          {MARKETING_CATEGORIES.map(([key, label]) => {
            const on = types.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes(on ? types.filter((t) => t !== key) : [...types, key])}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select aria-label="Show" value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
          <option value="all">Items and posts</option>
          <option value="items">Marketing items only</option>
          <option value="posts">Social posts only</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
          Show done and past
        </label>
        <div className="relative ml-auto min-w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input type="search" aria-label="Search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm" />
        </div>
        <button type="button" onClick={() => setAdding([`n${Date.now()}`, ...adding])} className={buttonClass("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add item
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {money(totals.amount)} in marketing items{stream !== "all" ? ` (${MARKETING_STREAMS.find(([k]) => k === stream)?.[1]})` : ""}
        {totals.unbudgeted > 0 && <span className="text-amber-700"> · {totals.unbudgeted} with a cost but no budget line</span>}
        {" · "}Changes save as you go. Event items also show on the event&apos;s Budget tab.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full table-fixed text-sm" style={{ minWidth: itemTableMinWidth() }}>
          <ItemTableHead />
          <tbody className="divide-y divide-slate-100">
            {adding.map((key) => (
              <ItemRow key={key} item={null} options={options} today={today} onDone={() => setAdding(adding.filter((k) => k !== key))} />
            ))}
            {rows.length === 0 && adding.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nothing here yet. Use <span className="font-medium">Add item</span> for Catapult marketing, or add marketing items on an event&apos;s Budget tab.
                </td>
              </tr>
            )}
            {rows.map((r) =>
              r.kind === "item" ? (
                <ItemRow key={r.item.id} item={r.item} options={options} today={today} />
              ) : r.kind === "post" ? (
                <PostRow key={`p-${r.post.id}`} post={r.post} />
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ItemRow({
  item,
  options,
  today,
  onDone,
  defaults,
  hide,
}: {
  /** Columns left out because the group they're in already says it (e.g. the stream). */
  hide?: ItemColumn[];
  item: MarketingItem | null;
  options: ItemOptions;
  today: string;
  onDone?: () => void;
  /** Starting values for a new row, e.g. the stream and event of the section it's added in. */
  defaults?: Partial<Draft>;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const show = (c: ItemColumn) => !hide?.includes(c);
  const [draft, setDraft] = useState<Draft>(() => draftOf(item, options, defaults));
  const saved = useRef(JSON.stringify(draftOf(item, options, defaults)));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const event = options.events.find((e) => e.id === draft.eventId) ?? (item?.event ? { ...item.event, lineId: null } : null);
  const due = deliveryDate(event?.day ?? null, (draft.timing as never) ?? null, draft.deliveryOn || null);
  const late = !!due && due < today && draft.status !== "done";

  function save(next: Draft) {
    if (JSON.stringify(next) === saved.current) return;
    // A new row waits until it has enough to be saved.
    if (!item && ((next.stream === "event" && !next.eventId) || (next.stream === "sponsorship" && !next.sponsorId) || !next.budgetLineId)) return;
    if (next.timing === "custom" && !next.deliveryOn) return;
    setState("saving");
    startTransition(async () => {
      const result = await saveMarketingItem({ id: item?.id ?? null, ...next }).catch(() => ({ error: "That didn't save. Please try again.", id: undefined }));
      if (result.error) {
        setState("error");
        setError(result.error);
        return;
      }
      saved.current = JSON.stringify(next);
      setState("saved");
      setError(null);
      if (!item) {
        onDone?.();
        toast("Marketing item added.");
      }
      router.refresh();
    });
  }

  function change(patch: Partial<Draft>, commit = true) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (commit) save(next);
  }

  const linesForEvent = options.lines.filter((l) => !l.eventId || l.eventId === draft.eventId);
  // Grouped by budget and section, so each choice is just the line's name and fits its cell.
  const byBudget = linesForEvent.reduce<Record<string, ItemOptions["lines"]>>((acc, l) => ((acc[l.section ? `${l.budgetName} · ${l.section}` : l.budgetName] ??= []).push(l), acc), {});

  return (
    <tr className={`align-top ${!item ? "bg-brand-50/30" : ""}`}>
      {show("stream") && (
        <td className="px-2 py-1.5">
          <select
            aria-label="Stream"
            value={draft.stream}
            onChange={(e) => {
              const s = e.target.value as MarketingStream;
              change({ stream: s, eventId: s === "catapult" ? null : draft.eventId, sponsorId: s === "sponsorship" ? draft.sponsorId : null, timing: s === "catapult" ? "custom" : draft.timing });
            }}
            className={`${PILL_CELL} font-medium ${MARKETING_STREAM_STYLES[draft.stream as MarketingStream]}`}
          >
            {MARKETING_STREAMS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </td>
      )}
      {show("type") && (
        <td className="px-2 py-1.5">
          <select aria-label="Marketing item" value={draft.type} onChange={(e) => change({ type: e.target.value })} className={`${PILL_CELL} ${MARKETING_CATEGORY_STYLES[draft.type] ?? "bg-white"}`}>
            {MARKETING_CATEGORIES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </td>
      )}
      {show("description") && (
        <td className="px-2 py-1.5">
          <input
            aria-label="Description"
            value={draft.description}
            placeholder={`${MARKETING_CATEGORY_LABELS[draft.type]}, e.g. ${draft.type === "social" ? "LinkedIn carousel" : draft.type === "production" ? "Event photographer" : draft.type === "creative" ? "Poster design" : "Meta ads"}`}
            onChange={(e) => change({ description: e.target.value }, false)}
            onBlur={() => save(draft)}
            className={CELL}
          />
          {error && (
            <p role="alert" className="mt-1 flex items-start gap-1 px-2 text-xs text-rose-700">
              <AlertCircle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
              {error}
            </p>
          )}
        </td>
      )}
      {show("event") && (
        <td className="px-2 py-1.5">
          {draft.stream === "catapult" ? (
            <span className="block px-2 py-1.5 text-slate-400">Catapult</span>
          ) : (
            <div className="space-y-1">
              {draft.stream === "sponsorship" && (
                <SponsorField
                  value={{ id: draft.sponsorId, name: draft.sponsorName }}
                  known={options.sponsors}
                  onPick={(s) => change({ sponsorId: s.id, sponsorName: s.name })}
                />
              )}
              <select
                aria-label="Event"
                value={draft.eventId ?? ""}
                onChange={(e) => {
                  const ev = options.events.find((x) => x.id === e.target.value);
                  change({ eventId: e.target.value || null, budgetLineId: draft.budgetLineId ?? ev?.lineId ?? null, timing: e.target.value ? draft.timing ?? "2_weeks" : "custom" });
                }}
                className={CELL}
              >
                <option value="">{draft.stream === "event" ? "Choose the event" : "No event"}</option>
                {options.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.whenLabel} · {e.title}
                  </option>
                ))}
                {item?.event && !options.events.some((e) => e.id === item.event!.id) && <option value={item.event.id}>{item.event.title}</option>}
              </select>
            </div>
          )}
        </td>
      )}
      {show("due") && (
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            {draft.eventId && (
              <select
                aria-label="When it's due"
                value={draft.timing ?? ""}
                onChange={(e) => change({ timing: e.target.value || null, deliveryOn: e.target.value === "custom" ? draft.deliveryOn || due || "" : draft.deliveryOn }, e.target.value !== "custom" || !!(draft.deliveryOn || due))}
                className={`${CELL} ${draft.timing === "custom" ? "w-24 shrink-0" : ""}`}
              >
                <option value="">No date</option>
                {DELIVERY_TIMINGS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {key === "custom" ? "Date" : label}
                  </option>
                ))}
              </select>
            )}
            {(!draft.eventId || draft.timing === "custom") && (
              <DateInput
                aria-label="Due date"
                value={draft.deliveryOn ?? ""}
                onChange={(e) => change({ timing: e.target.value ? "custom" : null, deliveryOn: e.target.value })}
                className={`${CELL} min-w-0`}
              />
            )}
          </div>
          {draft.eventId && draft.timing && draft.timing !== "custom" && <p className={`px-2 text-xs ${late ? "font-medium text-rose-700" : "text-slate-500"}`}>{late ? "Overdue · " : ""}{fmtDay(due)}</p>}
          {late && draft.timing === "custom" && <p className="px-2 text-xs font-medium text-rose-700">Overdue</p>}
        </td>
      )}
      {show("amount") && (
        <td className="px-2 py-1.5">
          <span className="relative block">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-slate-400">
              $
            </span>
            <input
              aria-label="Amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={draft.amount}
              onChange={(e) => change({ amount: e.target.value }, false)}
              onBlur={() => save(draft)}
              className={`${CELL} pl-5 text-right tabular-nums`}
            />
          </span>
        </td>
      )}
      {show("line") && (
        <td className="px-2 py-1.5">
          <select
            aria-label="Budget line"
            value={draft.budgetLineId ?? ""}
            onChange={(e) => change({ budgetLineId: e.target.value || null })}
            className={`${CELL} ${!draft.budgetLineId ? "text-amber-700" : ""}`}
          >
            <option value="">Choose the budget line</option>
            {Object.entries(byBudget).map(([budget, lines]) => (
              <optgroup key={budget} label={budget}>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </optgroup>
            ))}
            {item?.budgetLine && !linesForEvent.some((l) => l.id === item.budgetLine!.id) && <option value={item.budgetLine.id}>{item.budgetLine.name}</option>}
          </select>
        </td>
      )}
      {show("assigned") && (
        <td className="px-2 py-1.5">
          <select aria-label="Assigned to" value={draft.assignedTo ?? ""} onChange={(e) => change({ assignedTo: e.target.value || null })} className={`${CELL} ${!draft.assignedTo ? "text-slate-400" : ""}`}>
            <option value="">Unassigned</option>
            {options.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </td>
      )}
      {show("status") && (
        <td className="px-2 py-1.5">
          <select aria-label="Status" value={draft.status} onChange={(e) => change({ status: e.target.value })} className={`${PILL_CELL} ${MARKETING_STATUS_STYLES[draft.status as keyof typeof MARKETING_STATUS_STYLES]}`}>
            {MARKETING_STATUSES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </td>
      )}
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-1">
          <span className="w-4" aria-live="polite">
            {(pending || state === "saving") && <Loader2 className="h-4 w-4 animate-spin text-slate-400" strokeWidth={2} aria-label="Saving" />}
            {!pending && state === "saved" && <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-label="Saved" />}
          </span>
          {item && (
            <button
              type="button"
              aria-label={`Copy ${item.name}`}
              title="Copy"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await duplicateMarketingItem(item.id).catch(() => ({ error: "That wasn't copied." }));
                  if (result.error) toast(result.error, "error");
                  else {
                    toast("Copied.");
                    router.refresh();
                  }
                })
              }
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <Copy className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            title={item ? "Delete" : "Discard"}
            aria-label={item ? `Delete ${item.name}` : "Discard this new row"}
            onClick={async () => {
              if (!item) return onDone?.();
              const ok = await confirm({
                title: `Delete "${item.name}"?`,
                body: item.budgetLine ? `Its ${money(item.amount)} cost comes off ${item.budgetLine.name} too.` : undefined,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              startTransition(async () => {
                const result = await deleteMarketingItem(item.id).catch(() => ({ error: "That wasn't deleted." }));
                if (result.error) toast(result.error, "error");
                else router.refresh();
              });
            }}
            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function SponsorField({
  value,
  known,
  onPick,
}: {
  value: { id: string | null; name: string };
  known: { id: string; name: string }[];
  onPick: (s: { id: string; name: string }) => void;
}) {
  const [searching, setSearching] = useState(!value.id);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>(known.slice(0, 8));
  const [, startTransition] = useTransition();

  if (!searching && value.id) {
    return (
      <button type="button" onClick={() => setSearching(true)} className={`${CELL} truncate text-left`} title="Change the sponsor">
        {value.name}
      </button>
    );
  }
  return (
    <div className="relative">
      <input
        aria-label="Find the sponsor"
        autoFocus={!!value.id}
        placeholder="Find the sponsor company"
        value={q}
        onChange={(e) => {
          const next = e.target.value;
          setQ(next);
          startTransition(async () => setResults(next.trim().length >= 2 ? await searchSponsors(next).catch(() => []) : known.slice(0, 8)));
        }}
        className={`${CELL} border-slate-200 bg-white`}
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-popover">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setSearching(false);
                  setQ("");
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PostRow({ post, hide }: { post: PostItem; hide?: ItemColumn[] }) {
  const show = (c: ItemColumn) => !hide?.includes(c);
  const late = post.isPast && post.status !== "approved";
  return (
    <tr className="align-top bg-slate-50/60 text-slate-700">
      {show("stream") && (
        <td className="px-2 py-1.5">
          <span className={`${READ_CELL} font-medium ${MARKETING_STREAM_STYLES[post.event ? "event" : "catapult"]}`}>{post.event ? "Event" : "Catapult"}</span>
        </td>
      )}
      {show("type") && (
        <td className="px-2 py-1.5">
          <span className={`${READ_CELL} ${MARKETING_CATEGORY_STYLES.social}`}>Social post</span>
        </td>
      )}
      {show("description") && (
        <td className="px-2 py-1.5">
          <Link href={`/marketing/posts/${post.id}`} className="block px-2 py-1.5 font-medium text-slate-900 hover:text-brand-700 hover:underline">
            {post.title}
          </Link>
          <span className="block px-2 text-xs text-slate-500">{post.platforms.length ? post.channels.map((c) => c.name).join(", ") : "No channels yet"}</span>
        </td>
      )}
      {show("event") && (
        <td className="px-2 py-1.5">
          <span className="block truncate px-2 py-2 text-sm">{post.event?.title ?? post.initiative?.name ?? <span className="text-slate-400">Catapult</span>}</span>
        </td>
      )}
      {show("due") && (
        <td className="px-2 py-1.5">
          <span className={`block px-2 py-2 text-sm ${late ? "font-medium text-rose-700" : ""}`}>{post.scheduledLabel ?? "Not scheduled"}</span>
        </td>
      )}
      {show("amount") && (
        <td className="px-2 py-1.5">
          <span className="block px-2 py-2 text-right text-slate-400">—</span>
        </td>
      )}
      {show("line") && (
        <td className="px-2 py-1.5">
          <span className="block px-2 py-2 text-xs text-slate-500">Written in Social Planner</span>
        </td>
      )}
      {show("assigned") && (
        <td className="px-2 py-1.5">
          <span className="block px-2 py-2 text-sm text-slate-400">{post.createdByName ?? "—"}</span>
        </td>
      )}
      {show("status") && (
        <td className="px-2 py-1.5">
          <span className={READ_CELL}>
            <PostStatusPill status={post.status} size="sm" />
          </span>
        </td>
      )}
      <td className="px-2 py-2 text-right">
        <Link href={`/marketing/posts/${post.id}`} aria-label={`Open ${post.title}`} className="inline-flex rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700">
          <ExternalLink className="h-4 w-4" strokeWidth={2} />
        </Link>
      </td>
    </tr>
  );
}

export type ItemColumn = "stream" | "type" | "description" | "event" | "due" | "amount" | "line" | "assigned" | "status" | "actions";

/** Every column, with a fixed width in px so each dropdown shows its whole choice. Description takes what's left. */
const COLUMNS: { key: ItemColumn; label: string; width: number | null; right?: boolean }[] = [
  { key: "stream", label: "Stream", width: 128 },
  { key: "type", label: "Marketing item", width: 184 },
  { key: "description", label: "Description", width: null },
  { key: "event", label: "Event or sponsor", width: 224 },
  { key: "due", label: "Due", width: 184 },
  { key: "amount", label: "Amount", width: 96, right: true },
  { key: "line", label: "Budget line", width: 232 },
  { key: "assigned", label: "Assigned to", width: 152 },
  { key: "status", label: "Status", width: 152 },
  { key: "actions", label: "", width: 80 },
];
/** The least the description gets before the table scrolls sideways. */
const DESCRIPTION_MIN = 260;

/** The table's minimum width for the columns shown, so nothing is squeezed. */
export function itemTableMinWidth(hide: ItemColumn[] = []): number {
  return COLUMNS.filter((c) => !hide.includes(c.key)).reduce((s, c) => s + (c.width ?? DESCRIPTION_MIN), 0);
}

/** Column widths and headings shared by every item table. */
export function ItemTableHead({ hide = [] }: { hide?: ItemColumn[] }) {
  const cols = COLUMNS.filter((c) => !hide.includes(c.key));
  return (
    <>
      <colgroup>
        {cols.map((c) => (
          <col key={c.key} style={c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
        <tr>
          {cols.map((c) => (
            <th key={c.key} scope="col" className={`px-3 py-2.5 ${c.right ? "text-right" : ""}`}>
              {c.label || <span className="sr-only">Actions</span>}
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}
