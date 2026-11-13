"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { saveChannel } from "@/app/actions/marketing";
import { PlatformIcon } from "@/components/marketing/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { PLATFORMS } from "@/lib/marketing/constants";
import type { Channel } from "@/lib/marketing/queries";
import type { SocialPlatform } from "@/lib/supabase/types";

const INPUT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** The accounts posts go out on, grouped by platform. Admins add, rename and switch them off. */
export function ChannelsManager({ channels, isAdmin }: { channels: Channel[]; isAdmin: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {isAdmin
          ? "Add an account for each page posts go out on, such as a program's own Instagram. Switching one off hides it from new posts but keeps it on old ones."
          : "The accounts posts can go out on. An admin manages this list."}
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLATFORMS.map((p) => (
          <section key={p.key} aria-labelledby={`platform-${p.key}`} className="rounded-xl border border-slate-200 bg-white shadow-card">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <PlatformIcon platform={p.key} className="h-5 w-5" title="" />
              <h2 id={`platform-${p.key}`} className="font-semibold text-slate-900">
                {p.label}
              </h2>
            </header>
            <ul className="divide-y divide-slate-100">
              {channels.filter((c) => c.platform === p.key).map((c) => (
                <li key={c.id}>
                  <ChannelRow channel={c} isAdmin={isAdmin} />
                </li>
              ))}
              {channels.every((c) => c.platform !== p.key) && <li className="px-4 py-4 text-sm text-slate-500">No {p.label} channels yet.</li>}
            </ul>
            {isAdmin && <AddChannel platform={p.key} label={p.label} />}
          </section>
        ))}
      </div>
    </div>
  );
}

function useSave() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  function save(input: Parameters<typeof saveChannel>[0], done?: () => void, message = "Channel saved.") {
    startTransition(async () => {
      const result = await saveChannel(input).catch(() => ({ error: "That didn't save. Please try again." }));
      if (result.error) toast(result.error, "error");
      else {
        toast(message);
        done?.();
        router.refresh();
      }
    });
  }
  return { pending, save };
}

function ChannelRow({ channel, isAdmin }: { channel: Channel; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle ?? "");
  const { pending, save } = useSave();

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ id: channel.id, platform: channel.platform, name, handle, active: channel.active }, () => setEditing(false));
        }}
        className="space-y-2 px-4 py-3"
      >
        <input aria-label="Channel name" required value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} w-full`} />
        <input aria-label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle (optional)" className={`${INPUT} w-full`} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${channel.active ? "" : "bg-slate-50"}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${channel.active ? "text-slate-900" : "text-slate-500"}`}>{channel.name}</p>
        <p className="truncate text-xs text-slate-500">
          {channel.handle ? `@${channel.handle}` : "No handle"}
          {!channel.active && " · Off"}
        </p>
      </div>
      {isAdmin && (
        <>
          <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
            Edit
          </button>
          <label className="inline-flex cursor-pointer items-center" title={channel.active ? "Switch off" : "Switch on"}>
            <span className="sr-only">{channel.active ? `Switch off ${channel.name}` : `Switch on ${channel.name}`}</span>
            <input
              type="checkbox"
              role="switch"
              checked={channel.active}
              disabled={pending}
              onChange={() =>
                save({ id: channel.id, platform: channel.platform, name: channel.name, handle: channel.handle ?? "", active: !channel.active }, undefined, channel.active ? "Channel switched off." : "Channel switched on.")
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300"
            />
          </label>
        </>
      )}
    </div>
  );
}

function AddChannel({ platform, label }: { platform: SocialPlatform; label: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const { pending, save } = useSave();

  if (!open) {
    return (
      <div className="border-t border-slate-100 px-4 py-2.5">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add a {label} channel
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ id: null, platform, name, handle, active: true }, () => {
          setOpen(false);
          setName("");
          setHandle("");
        }, "Channel added.");
      }}
      className="space-y-2 border-t border-slate-100 px-4 py-3"
    >
      <input aria-label="Channel name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. Apex Forum on ${label}`} className={`${INPUT} w-full`} />
      <input aria-label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle (optional)" className={`${INPUT} w-full`} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          Add channel
        </button>
      </div>
    </form>
  );
}
