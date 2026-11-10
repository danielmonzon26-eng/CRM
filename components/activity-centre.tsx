"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Handshake,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { addNote, deleteNote, setNotePinned, updateNote } from "@/app/actions/notes";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { LeadNote, TimelineCategory, TimelineItem } from "@/lib/activity/timeline";
import type { NoteKind } from "@/lib/supabase/types";

type Icon = typeof StickyNote;

const KINDS: { kind: NoteKind; label: string; icon: Icon; placeholder: string }[] = [
  { kind: "note", label: "Note", icon: StickyNote, placeholder: "Add a note for the team..." },
  { kind: "call", label: "Call", icon: Phone, placeholder: "Who you spoke with, what was said, next step..." },
  { kind: "meeting", label: "Meeting", icon: Users, placeholder: "Who was there, what was decided, next step..." },
  { kind: "email", label: "Email", icon: Mail, placeholder: "Summary of an email sent outside the CRM..." },
];

const FILTERS: { key: "all" | TimelineCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "calls", label: "Calls & meetings" },
  { key: "email", label: "Email" },
  { key: "proposals", label: "Proposals" },
  { key: "stage", label: "Stage & status" },
  { key: "events", label: "Events" },
  { key: "discovery", label: "Discovery" },
  { key: "tasks", label: "Tasks" },
];

const ICONS: Record<string, { icon: Icon; tone: string }> = {
  note_note: { icon: StickyNote, tone: "bg-amber-50 text-amber-700" },
  note_call: { icon: Phone, tone: "bg-sky-50 text-sky-700" },
  note_meeting: { icon: Users, tone: "bg-sky-50 text-sky-700" },
  note_email: { icon: Mail, tone: "bg-indigo-50 text-indigo-700" },
  email_in: { icon: ArrowDownLeft, tone: "bg-indigo-50 text-indigo-700" },
  email_out: { icon: ArrowUpRight, tone: "bg-indigo-50 text-indigo-700" },
  email_sent: { icon: Mail, tone: "bg-indigo-50 text-indigo-700" },
  meeting: { icon: CalendarDays, tone: "bg-sky-50 text-sky-700" },
  call_logged: { icon: Phone, tone: "bg-sky-50 text-sky-700" },
  status_change: { icon: RefreshCw, tone: "bg-slate-100 text-slate-600" },
  note: { icon: RefreshCw, tone: "bg-slate-100 text-slate-600" },
  deal_created: { icon: Handshake, tone: "bg-violet-50 text-violet-700" },
  deal_stage_change: { icon: TrendingUp, tone: "bg-violet-50 text-violet-700" },
  event_registration: { icon: CalendarDays, tone: "bg-emerald-50 text-emerald-700" },
  event_attended: { icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
  discovery: { icon: ClipboardList, tone: "bg-brand-50 text-brand-700" },
  task_completed: { icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
  enrichment_run: { icon: Sparkles, tone: "bg-slate-100 text-slate-500" },
  sync_matched: { icon: RefreshCw, tone: "bg-slate-100 text-slate-500" },
};

const LONG_BODY = 280;

function localInputValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Every touchpoint with the company in one place, with notes, calls and meetings logged
 * at the top. Filters and search work on what's already loaded.
 */
export function ActivityCentre({ leadId, notes, items }: { leadId: string; notes: LeadNote[]; items: TimelineItem[] }) {
  const [filter, setFilter] = useState<"all" | TimelineCategory>("all");
  const [query, setQuery] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const noteById = useMemo(() => new Map(notes.map((n) => [`note-${n.id}`, n])), [notes]);
  const pinned = notes.filter((n) => n.pinned);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: 0 };
    for (const item of items) {
      if (item.category === "system") continue;
      result.all += 1;
      result[item.category] = (result[item.category] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (item.category === "system" && !showSystem) return false;
      if (filter !== "all" && item.category !== filter) return false;
      if (term && ![item.title, item.body, item.actor].some((t) => t?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, filter, query, showSystem]);

  const groups = useMemo(() => {
    const result: { day: string; items: TimelineItem[] }[] = [];
    for (const item of visible) {
      const last = result[result.length - 1];
      if (last && last.day === item.dayLabel) last.items.push(item);
      else result.push({ day: item.dayLabel, items: [item] });
    }
    return result;
  }, [visible]);

  return (
    <section id="activity" aria-labelledby="activity-title" className="scroll-mt-20">
      <h2 id="activity-title" className="text-sm font-semibold text-slate-700">
        Activity Centre
      </h2>

      <div className="mt-2 space-y-4">
        <NoteComposer leadId={leadId} />

        {pinned.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Pin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} /> Pinned
            </h3>
            <ul className="mt-2 space-y-2">
              {pinned.map((note) => (
                <li key={note.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <NoteBody note={note} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Filter activity" className="flex flex-wrap gap-1.5">
            {FILTERS.filter((f) => f.key === "all" || counts[f.key]).map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  filter === f.key ? "bg-ink-950 font-medium text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label} <span className={filter === f.key ? "text-white/70" : "text-slate-400"}>{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-56">
            <span className="sr-only">Search activity</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity"
              className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {items.length === 0 ? "No activity yet. Log a note, call or meeting above to start the history." : "Nothing matches. Try another filter or search."}
          </p>
        ) : (
          <ol className="space-y-5">
            {groups.map((group) => (
              <li key={group.day}>
                <h3 className="sticky top-14 z-[1] -mx-1 mb-2 bg-slate-50/90 px-1 py-1 text-xs font-semibold text-slate-500 backdrop-blur">{group.day}</h3>
                <ol className="relative space-y-3 border-l border-slate-200 pl-6">
                  {group.items.map((item) => {
                    const meta = ICONS[item.type] ?? { icon: StickyNote, tone: "bg-slate-100 text-slate-600" };
                    const ItemIcon = meta.icon;
                    const note = noteById.get(item.id);
                    return (
                      <li key={item.id} className="relative">
                        <span aria-hidden="true" className={`absolute -left-[37px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-slate-50 ${meta.tone}`}>
                          <ItemIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        {note ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                            <NoteBody note={note} />
                          </div>
                        ) : (
                          <TimelineEntry item={item} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        )}

        {items.some((i) => i.category === "system") && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
            Show automatic data updates
          </label>
        )}
      </div>
    </section>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const long = (item.body?.length ?? 0) > LONG_BODY;
  const body = item.body && long && !expanded ? `${item.body.slice(0, LONG_BODY)}…` : item.body;
  return (
    <div className="pt-0.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        {item.href ? (
          <Link href={item.href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
            {item.title}
          </Link>
        ) : (
          <span className="font-medium text-slate-900">{item.title}</span>
        )}
        <span className="text-xs text-slate-500">
          {item.timeLabel}
          {item.actor ? ` · ${item.actor}` : ""}
        </span>
      </p>
      {body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">{body}</p>}
      {long && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-medium text-brand-700 hover:underline">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function NoteComposer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<NoteKind>("note");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [latest, setLatest] = useState<string | undefined>(undefined);
  const [saving, startSaving] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const active = KINDS.find((k) => k.kind === kind)!;

  // The default time is set in the browser so it's in the viewer's own clock.
  useEffect(() => {
    setWhen(localInputValue());
    setLatest(localInputValue(new Date(Date.now() + 3_600_000)));
  }, [kind]);

  function save() {
    if (!body.trim()) {
      textRef.current?.focus();
      return;
    }
    startSaving(async () => {
      const result = await addNote(leadId, { kind, body, occurredAt: when ? new Date(when).toISOString() : undefined }).catch(() => ({
        error: "The note wasn't saved. Please try again.",
      }));
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setBody("");
      setWhen(localInputValue());
      toast(`${active.label} logged.`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="rounded-xl border border-slate-200 bg-white shadow-card focus-within:border-brand-300"
    >
      <div role="tablist" aria-label="What are you logging?" className="flex gap-1 border-b border-slate-100 px-2 pt-2">
        {KINDS.map((k) => {
          const KindIcon = k.icon;
          const on = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setKind(k.kind)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                on ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <KindIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              {k.label}
            </button>
          );
        })}
      </div>
      <label className="sr-only" htmlFor={`note-${leadId}`}>
        {active.label}
      </label>
      <textarea
        id={`note-${leadId}`}
        ref={textRef}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        placeholder={active.placeholder}
        className="block w-full resize-y border-0 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          When
          <input
            type="datetime-local"
            value={when}
            max={latest}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-400 sm:inline">⌘ + Enter to save</span>
          <button type="submit" disabled={saving || !body.trim()} className={buttonClass("primary", "sm")}>
            {saving ? "Saving..." : `Log ${active.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </form>
  );
}

function NoteBody({ note }: { note: LeadNote }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const kind = KINDS.find((k) => k.kind === note.kind)!;

  function run(action: () => Promise<{ error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action().catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      after?.();
      toast(success);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-slate-900">{kind.label}</span>
          <span className="text-xs text-slate-500">
            {note.occurredLabel}
            {note.author ? ` · ${note.author}` : ""}
            {note.edited ? " · edited" : ""}
          </span>
        </p>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Note options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            onBlur={(e) => {
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setMenuOpen(false);
            }}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
          {menuOpen && (
            <div role="menu" className="animate-pop absolute right-0 top-7 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-popover">
              <MenuItem icon={note.pinned ? PinOff : Pin} onClick={() => { setMenuOpen(false); run(() => setNotePinned(note.id, !note.pinned), note.pinned ? "Unpinned." : "Pinned to the top."); }}>
                {note.pinned ? "Unpin" : "Pin to top"}
              </MenuItem>
              <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); setDraft(note.body); setEditing(true); }}>
                Edit
              </MenuItem>
              <MenuItem
                icon={Trash2}
                danger
                onClick={async () => {
                  setMenuOpen(false);
                  const ok = await confirm({ title: `Delete this ${kind.label.toLowerCase()}?`, body: "It's removed for everyone. This can't be undone.", confirmLabel: "Delete", danger: true });
                  if (ok) run(() => deleteNote(note.id), "Deleted.");
                }}
              >
                Delete
              </MenuItem>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateNote(note.id, { body: draft }), "Saved.", () => setEditing(false));
          }}
          className="mt-2"
        >
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
            <button type="submit" disabled={pending || !draft.trim()} className={buttonClass("primary", "sm")}>
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{note.body}</p>
      )}
    </div>
  );
}

function MenuItem({ icon: ItemIcon, onClick, children, danger = false }: { icon: Icon; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}
    >
      <ItemIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}
