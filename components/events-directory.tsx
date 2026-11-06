"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Copy,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { duplicateEvent, setEventsArchived } from "@/app/actions/events";
import { useFeedback } from "@/components/ui/feedback";
import { FilterSelect, SearchField } from "@/components/ui/filter-controls";
import { EmptyState } from "@/components/ui/page";
import { buttonClass } from "@/components/ui/button";
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  calgaryDateKey,
  formatEventWhen,
  formatTicketPrice,
  isEventOver,
} from "@/lib/events/format";
import type { EventListItem } from "@/lib/events/queries";

const TABS = ["All events", "Upcoming", "Drafts", "Published", "Completed", "Archived"] as const;
type Tab = (typeof TABS)[number];

const SELECT = "h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const VIEWS_KEY = "catapult-event-views";

type Filters = { search: string; program: string; type: string; status: string; from: string; to: string };
type SavedView = { name: string; tab: Tab; filters: Filters };
const NO_FILTERS: Filters = { search: "", program: "", type: "", status: "", from: "", to: "" };

function matchesTab(event: EventListItem, tab: Tab): boolean {
  if (tab === "Archived") return Boolean(event.archived_at);
  if (event.archived_at) return false;
  const over = isEventOver(event.starts_at, event.ends_at);
  if (tab === "Upcoming") return !over && event.status !== "cancelled";
  if (tab === "Drafts") return event.status === "draft";
  if (tab === "Published") return event.status === "published";
  if (tab === "Completed") return over && event.status !== "cancelled";
  return true;
}

function location(event: EventListItem): string {
  if (event.format === "online") return FORMAT_LABELS.online;
  return `${event.venue_name ?? "Venue not set"}${event.format === "hybrid" ? " + livestream" : ""}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function Thumbnail({ event }: { event: EventListItem }) {
  if (event.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={event.image_url} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />;
  }
  return (
    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
      <Ticket className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

function StatusBadge({ event }: { event: EventListItem }) {
  if (event.archived_at) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Archived</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status]}`}>{STATUS_LABELS[event.status]}</span>;
}

function Registrations({ event }: { event: EventListItem }) {
  const fill = event.capacity ? Math.min(100, Math.round((event.registeredCount / event.capacity) * 100)) : null;
  return (
    <div className="w-24">
      <p className="text-sm text-slate-700">
        {event.registeredCount}
        {event.capacity ? ` / ${event.capacity}` : ""}
      </p>
      {fill !== null && (
        <div role="progressbar" aria-label="Registrations" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${fill}%` }} />
        </div>
      )}
    </div>
  );
}

export function EventsDirectory({ events, ownerNames }: { events: EventListItem[]; ownerNames: Record<string, string> }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("All events");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { promptText, toast } = useFeedback();

  useEffect(() => {
    try {
      setSavedViews(JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]"));
    } catch {
      setSavedViews([]);
    }
  }, []);

  function storeViews(next: SavedView[]) {
    setSavedViews(next);
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    } catch {
      setError("Saved views aren't available in this browser.");
    }
  }

  const programs = useMemo(() => [...new Set(events.map((e) => e.program).filter(Boolean))].sort() as string[], [events]);
  const types = useMemo(() => [...new Set(events.map((e) => e.event_type).filter(Boolean))].sort() as string[], [events]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return events.filter((e) => {
      if (!matchesTab(e, tab)) return false;
      if (filters.program && e.program !== filters.program) return false;
      if (filters.type && e.event_type !== filters.type) return false;
      if (filters.status && e.status !== filters.status) return false;
      const day = calgaryDateKey(e.starts_at);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (search && ![e.title, e.program, e.event_type, e.venue_name].some((v) => v?.toLowerCase().includes(search))) return false;
      return true;
    });
  }, [events, tab, filters]);

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const setFilter = (key: keyof Filters, value: string) => setFilters((c) => ({ ...c, [key]: value }));
  const toggle = (id: string) =>
    setSelected((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  function archive(ids: string[], archived: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setEventsArchived(ids, archived);
      if (result.error) {
        setError(result.error);
      } else {
        setSelected(new Set());
        toast(`${ids.length === 1 ? "Event" : `${ids.length} events`} ${archived ? "archived" : "restored"}`);
      }
    });
  }

  function duplicate(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await duplicateEvent(id);
      if (result.error) setError(result.error);
      else router.push(`/events/${result.id}/edit`);
    });
  }

  async function saveView() {
    const name = await promptText({ title: "Save this view", label: "View name" });
    if (name) storeViews([...savedViews.filter((v) => v.name !== name), { name, tab, filters }]);
  }

  const actions = (event: EventListItem) => (
    <div className="flex justify-end gap-0.5">
      <Link href={`/events/${event.id}/edit`} aria-label={`Edit ${event.title}`} title="Edit" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <Pencil className="h-4 w-4" strokeWidth={2} />
      </Link>
      <button type="button" disabled={isPending} onClick={() => duplicate(event.id)} aria-label={`Duplicate ${event.title}`} title="Duplicate" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50">
        <Copy className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => archive([event.id], !event.archived_at)}
        aria-label={`${event.archived_at ? "Restore" : "Archive"} ${event.title}`}
        title={event.archived_at ? "Restore" : "Archive"}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
      >
        {event.archived_at ? <ArchiveRestore className="h-4 w-4" strokeWidth={2} /> : <Archive className="h-4 w-4" strokeWidth={2} />}
      </button>
    </div>
  );

  return (
    <div>
      <div role="tablist" aria-label="Filter events" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            onClick={() => {
              setTab(t);
              setSelected(new Set());
            }}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
              t === tab ? "border-brand-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t}
            <span className="ml-1.5 text-xs font-normal text-slate-500">{events.filter((e) => matchesTab(e, t)).length}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField className="w-full" label="Search events" placeholder="Search events..." value={filters.search} onChange={(value) => setFilter("search", value)} />
        <FilterSelect label="Program" value={filters.program} onChange={(value) => setFilter("program", value)} options={programs.map((p) => ({ value: p, label: p }))} />
        <FilterSelect label="Type" value={filters.type} onChange={(value) => setFilter("type", value)} options={types.map((t) => ({ value: t, label: t }))} />
        <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilter("status", value)} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "cancelled", label: "Cancelled" }]} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          From
          <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className={SELECT} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          To
          <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className={SELECT} />
        </label>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button type="button" aria-label="Table view" aria-pressed={view === "table"} onClick={() => setView("table")} className={`rounded-md p-1.5 ${view === "table" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-900"}`}>
            <List className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" aria-label="Card view" aria-pressed={view === "cards"} onClick={() => setView("cards")} className={`rounded-md p-1.5 ${view === "cards" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-900"}`}>
            <LayoutGrid className="h-4 w-4" strokeWidth={2} />
          </button>
          <Link href="/calendar" aria-label="Calendar view" className="rounded-md p-1.5 text-slate-500 hover:text-slate-900">
            <CalendarDays className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-slate-500">Saved views:</span>
        {savedViews.map((v) => (
          <span key={v.name} className="inline-flex items-center rounded-full border border-slate-200 bg-white text-xs text-slate-700">
            <button
              type="button"
              onClick={() => {
                setTab(v.tab);
                setFilters(v.filters);
              }}
              className="py-1 pl-2.5 pr-1 hover:text-slate-900"
            >
              {v.name}
            </button>
            <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => storeViews(savedViews.filter((s) => s.name !== v.name))} className="rounded-full p-1 text-slate-400 hover:text-rose-700">
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        <button type="button" onClick={saveView} className="text-xs font-medium text-brand-600 hover:underline">Save current view</button>
        {hasFilters && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Clear filters</button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-ink-950 px-4 py-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <button type="button" disabled={isPending} onClick={() => archive([...selected], tab !== "Archived")} className="font-medium underline-offset-2 hover:underline disabled:opacity-50">
            {tab === "Archived" ? "Restore" : "Archive"}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-ink-200 hover:text-white">Clear</button>
        </div>
      )}

      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={events.length === 0 ? "No events yet" : "No events match"}
          description={events.length === 0 ? "Create your first event to start taking registrations." : "Try another tab, or clear your filters."}
          action={events.length === 0 ? <Link href="/events/new" className={buttonClass("primary")}>New event</Link> : undefined}
        />
      ) : view === "table" ? (
        // `relative` keeps the table's screen-reader-only label inside this scrolling area.
        <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)))}
                    className="h-4 w-4 accent-brand-600"
                  />
                </th>
                <th scope="col" className="px-2 py-3 font-medium">Event</th>
                <th scope="col" className="px-3 py-3 font-medium">Date</th>
                <th scope="col" className="px-3 py-3 font-medium">Location</th>
                <th scope="col" className="px-3 py-3 font-medium">Registrations</th>
                <th scope="col" className="px-3 py-3 font-medium">Budget</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 font-medium">Owner</th>
                <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${event.title}`} checked={selected.has(event.id)} onChange={() => toggle(event.id)} className="h-4 w-4 accent-brand-600" />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/events/${event.id}`} className="flex items-center gap-3">
                      <Thumbnail event={event} />
                      <span className="min-w-0">
                        <span className="block max-w-xs truncate font-medium text-slate-900 hover:text-brand-700">{event.title}</span>
                        <span className="block text-xs text-slate-500">{[event.program, event.event_type].filter(Boolean).join(" · ") || "No program"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-44 px-3 py-3 text-xs text-slate-600">{formatEventWhen(event.starts_at, event.ends_at)}</td>
                  <td className="max-w-48 truncate px-3 py-3 text-slate-600">{location(event)}</td>
                  <td className="px-3 py-3"><Registrations event={event} /></td>
                  <td className="px-3 py-3 text-slate-600">{event.budget_amount != null ? money(event.budget_amount) : "—"}</td>
                  <td className="px-3 py-3"><StatusBadge event={event} /></td>
                  <td className="max-w-32 truncate px-3 py-3 text-slate-600">{event.owner_id ? ownerNames[event.owner_id] ?? "Unknown" : "—"}</td>
                  <td className="px-3 py-3">{actions(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((event) => (
            <article key={event.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <Link href={`/events/${event.id}`} className="flex-1 hover:bg-slate-50">
                {event.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.image_url} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-brand-50 text-brand-600"><Ticket className="h-7 w-7" strokeWidth={1.75} /></div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500">{event.program ?? "No program"}</p>
                    <StatusBadge event={event} />
                  </div>
                  <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p className="flex items-start gap-1.5"><CalendarDays className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />{formatEventWhen(event.starts_at, event.ends_at)}</p>
                    <p className="flex items-start gap-1.5"><MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />{location(event)}</p>
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                      {event.registeredCount}{event.capacity ? ` of ${event.capacity}` : ""} registered · {formatTicketPrice(event.ticket_type, event.ticket_price, event.currency)}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="border-t border-slate-100 px-2 py-1">{actions(event)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
