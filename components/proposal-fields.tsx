"use client";

import { Check } from "lucide-react";
import { PAYMENT_LABELS } from "@/lib/deals/stages";
import { LEAD_PROGRAMS } from "@/lib/leads/classification";
import { getInitials } from "@/lib/text";
import type { DealPayment } from "@/lib/supabase/types";

/** Toggle chips for the work a proposal covers (any of the four). */
export function WorkTypePicker({
  value,
  onChange,
  disabled,
  legend = "Work we do",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  legend?: string;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LEAD_PROGRAMS.map(([key, label]) => {
          const on = value.includes(key);
          return (
            <label
              key={key}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                on ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((v) => v !== key))}
              />
              {on && <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />}
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pick the team members working on the proposal. */
export function StaffPicker({
  staff,
  value,
  onChange,
  disabled,
  loadFailed = false,
}: {
  staff: { id: string; name: string }[] | null;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  loadFailed?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Staff working on it</legend>
      {loadFailed ? (
        <p className="mt-1.5 text-sm text-rose-700">The team list didn&apos;t load. You can add staff from the proposal page.</p>
      ) : staff === null ? (
        <p className="mt-1.5 text-sm text-slate-500">Loading team...</p>
      ) : staff.length === 0 ? (
        <p className="mt-1.5 text-sm text-slate-500">No team members yet. Add them on the Admin page.</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {staff.map((member) => {
            const on = value.includes(member.id);
            return (
              <label
                key={member.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  on ? "border-ink-950 bg-ink-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => onChange(e.target.checked ? [...value, member.id] : value.filter((v) => v !== member.id))}
                />
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${on ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}
                >
                  {getInitials(member.name)}
                </span>
                {member.name}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/** Paid / Unpaid / Not set, as a segmented control. */
export function PaymentToggle({
  value,
  onChange,
  disabled,
}: {
  value: DealPayment | null;
  onChange: (next: DealPayment | null) => void;
  disabled?: boolean;
}) {
  const options: [DealPayment | null, string][] = [
    ["paid", PAYMENT_LABELS.paid],
    ["unpaid", PAYMENT_LABELS.unpaid],
    [null, "Not set"],
  ];
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Paid or unpaid</legend>
      <div className="mt-1.5 inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {options.map(([option, label]) => (
          <label
            key={label}
            className={`cursor-pointer rounded-md px-3 py-1 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
              value === option ? "bg-ink-950 font-medium text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <input type="radio" name="payment" className="sr-only" checked={value === option} onChange={() => onChange(option)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PaymentBadge({ payment }: { payment: DealPayment | null }) {
  if (!payment) return null;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        payment === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
      }`}
    >
      {PAYMENT_LABELS[payment]}
    </span>
  );
}

export function StaffAvatars({ names, max = 3 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-[11px] text-slate-500">No staff</span>;
  const shown = names.slice(0, max);
  return (
    <span className="flex -space-x-1.5" title={`Staff: ${names.join(", ")}`}>
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 text-[10px] font-semibold text-white ring-2 ring-white"
        >
          {getInitials(name)}
        </span>
      ))}
      {names.length > max && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white">
          +{names.length - max}
        </span>
      )}
    </span>
  );
}
