"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { loadLeadQuickEdit, saveLeadQuickEdit } from "@/app/actions/leads";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { NAICS_SECTORS, industryLabelForCode, parseIndustry } from "@/lib/industries/naics";
import { CLIENT_TYPES, LEAD_PROGRAMS } from "@/lib/leads/classification";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/leads/filters";
import { getQuickEditChanges, type QuickEditChanges, type QuickEditRecord, type QuickEditValues } from "@/lib/leads/quick-edit";
import type { LeadFacets } from "@/lib/leads/search";
import type { LeadStatus } from "@/lib/supabase/types";

const FIELD = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";
const SECTION = "border-t border-slate-100 pt-4 first:border-t-0 first:pt-0";
const SECTION_TITLE = "text-xs font-semibold uppercase tracking-wide text-slate-500";

type Member = { id: string; name: string };

function QuickEditFields({
  record,
  values,
  members,
  facets,
  onChange,
}: {
  record: QuickEditRecord;
  values: QuickEditValues;
  members: Member[];
  facets: LeadFacets;
  onChange: (patch: Partial<QuickEditValues>) => void;
}) {
  const text = (key: keyof QuickEditValues) => ({
    value: values[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value }),
    className: FIELD,
  });

  return (
    <div className="space-y-4">
      <section className={SECTION}>
        <h3 className={SECTION_TITLE}>Lead</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className={LABEL}>
            Status
            <select value={values.status} onChange={(e) => onChange({ status: e.target.value as LeadStatus })} className={FIELD}>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className={LABEL}>
            Owner
            <select value={values.assignedTo} onChange={(e) => onChange({ assignedTo: e.target.value })} className={FIELD}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className={LABEL}>
            Client type
            <select value={values.clientType} onChange={(e) => onChange({ clientType: e.target.value })} className={FIELD}>
              <option value="">Not set</option>
              {CLIENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="mt-3">
          <legend className={LABEL}>Programs</legend>
          <div className="mt-1.5 grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
            {LEAD_PROGRAMS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={values.programs.includes(value)}
                  onChange={(e) => onChange({ programs: e.target.checked ? [...values.programs, value] : values.programs.filter((p) => p !== value) })}
                  className="h-4 w-4 accent-brand-600"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={SECTION}>
        <h3 className={SECTION_TITLE}>Company</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={`${LABEL} sm:col-span-2`}>
            Company name
            <input required {...text("companyName")} />
          </label>
          <label className={LABEL}>
            Industry
            <select value={values.industry} onChange={(e) => onChange({ industry: e.target.value })} className={FIELD}>
              <option value="">Not set</option>
              {/* Older license wording stays selectable until someone changes it. */}
              {values.industry && !parseIndustry(values.industry) && <option value={values.industry}>{values.industry}</option>}
              {NAICS_SECTORS.map((sector) => (
                <optgroup key={sector.code} label={sector.title}>
                  {sector.subsectors.map((sub) => <option key={sub.code} value={industryLabelForCode(sub.code)!}>{sub.title}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Community
            <input list="quick-edit-communities" {...text("community")} />
            <datalist id="quick-edit-communities">
              {facets.communities.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className={LABEL}>
            Website
            <input inputMode="url" placeholder="example.com" {...text("website")} />
          </label>
          <label className={LABEL}>
            Phone
            <input type="tel" {...text("companyPhone")} />
          </label>
        </div>
      </section>

      <section className={SECTION}>
        <h3 className={SECTION_TITLE}>{record.contactId ? "Primary contact" : "Add a primary contact"}</h3>
        {record.otherContacts > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {record.otherContacts} other {record.otherContacts === 1 ? "contact is" : "contacts are"} on the full record.
          </p>
        )}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            Name
            <input autoComplete="off" {...text("contactName")} />
          </label>
          <label className={LABEL}>
            Title
            <input autoComplete="off" {...text("contactTitle")} />
          </label>
          <label className={LABEL}>
            Email
            <input type="email" autoComplete="off" {...text("contactEmail")} />
          </label>
          <label className={LABEL}>
            Phone
            <input type="tel" autoComplete="off" {...text("contactPhone")} />
          </label>
        </div>
      </section>
    </div>
  );
}

function QuickEditLoading() {
  return (
    <div aria-busy="true" aria-label="Loading lead" className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

/** The popup itself. It needs a native modal, so messages show inside it rather than as toasts. */
export function LeadQuickEditDialog({
  leadId,
  companyName,
  record,
  loadFailed,
  members,
  facets,
  onSave,
  onClosed,
}: {
  leadId: string;
  companyName: string;
  record: QuickEditRecord | null;
  loadFailed: boolean;
  members: Member[];
  facets: LeadFacets;
  onSave: (record: QuickEditRecord, changes: QuickEditChanges) => Promise<{ error?: string }>;
  onClosed: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<QuickEditValues | null>(record?.values ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (record) setValues(record.values);
  }, [record]);

  const hasFields = Boolean(record && values);
  useEffect(() => {
    if (hasFields) dialogRef.current?.querySelector("select")?.focus();
  }, [hasFields]);

  const changes = record && values ? getQuickEditChanges(record.values, values) : {};
  const isDirty = Object.keys(changes).length > 0;
  const close = () => dialogRef.current?.close();

  function requestClose() {
    if (isDirty) setConfirmingDiscard(true);
    else close();
  }

  function save() {
    if (!record) return;
    setError(null);
    startSaving(async () => {
      try {
        const result = await onSave(record, changes);
        if (result.error) setError(result.error);
        else close();
      } catch {
        setError("Those changes didn't save. Please try again.");
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="quick-edit-title"
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClose={onClosed}
      className="animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl bg-white p-0 text-left shadow-popover backdrop:bg-ink-950/50"
    >
      <form
        className="flex max-h-[calc(100dvh-2rem)] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="quick-edit-title" className="text-lg font-semibold text-slate-900">Quick edit</h2>
            <p className="truncate text-sm text-slate-600">{companyName}</p>
          </div>
          <Link href={`/leads/${leadId}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
            Full record
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadFailed ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">This lead didn&apos;t load. Close this and try again.</p>
          ) : record && values ? (
            <QuickEditFields
              record={record}
              values={values}
              members={members}
              facets={facets}
              onChange={(patch) => {
                setConfirmingDiscard(false);
                setValues((current) => (current ? { ...current, ...patch } : current));
              }}
            />
          ) : (
            <QuickEditLoading />
          )}
        </div>

        <footer className="border-t border-slate-100 px-5 py-3">
          {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {confirmingDiscard ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p role="status" className="mr-auto text-sm font-medium text-slate-800">Discard your changes?</p>
              <button type="button" onClick={() => setConfirmingDiscard(false)} className={buttonClass("secondary")}>Keep editing</button>
              <button type="button" onClick={close} className="inline-flex items-center justify-center rounded-lg bg-rose-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-rose-800">Discard</button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={requestClose} className={buttonClass("secondary")}>Cancel</button>
              <button type="submit" disabled={!isDirty || isSaving} className={buttonClass("primary")}>{isSaving ? "Saving..." : "Save changes"}</button>
            </div>
          )}
        </footer>
      </form>
    </dialog>
  );
}

/** Loads a lead's current details when opened, so nothing is edited from an out-of-date table row. */
export function LeadQuickEdit({
  leadId,
  companyName,
  members,
  facets,
  onClosed,
}: {
  leadId: string;
  companyName: string;
  members: Member[];
  facets: LeadFacets;
  onClosed: () => void;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [record, setRecord] = useState<QuickEditRecord | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    loadLeadQuickEdit(leadId)
      .then((loaded) => {
        if (!isCurrent) return;
        if (loaded) setRecord(loaded);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (isCurrent) setLoadFailed(true);
      });
    return () => {
      isCurrent = false;
    };
  }, [leadId]);

  return (
    <LeadQuickEditDialog
      leadId={leadId}
      companyName={companyName}
      record={record}
      loadFailed={loadFailed}
      members={members}
      facets={facets}
      onClosed={onClosed}
      onSave={async (current, changes) => {
        const result = await saveLeadQuickEdit({ leadId: current.leadId, contactId: current.contactId }, changes);
        if (!result.error) {
          toast(`${changes.companyName ?? companyName} updated`);
          router.refresh();
        }
        return result;
      }}
    />
  );
}
