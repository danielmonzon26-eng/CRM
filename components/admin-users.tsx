"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, UserPlus } from "lucide-react";
import { addUser, createUserLink, giveAdminAccess, setUserAccess, setUserName, setUserPassword } from "@/app/actions/team";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { getInitials } from "@/lib/text";
import type { AdminUser, UserStatus } from "@/lib/team/users";
import { personName } from "@/lib/team/names";

const STATUS: Record<Exclude<UserStatus, "unknown">, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800" },
  invited: { label: "Not signed in yet", className: "bg-amber-50 text-amber-800" },
  removed: { label: "Removed", className: "bg-slate-100 text-slate-700" },
};

const FIELD = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const DIALOG = "animate-pop m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl bg-white p-5 text-left shadow-popover backdrop:bg-ink-950/50";

const lastSignIn = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Edmonton" });

type SharedLink = { name: string; email: string | null; link: string; isNew: boolean };

export function AdminUsers({ users, currentUserId, canManage }: { users: AdminUser[]; currentUserId: string; canManage: boolean }) {
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [shared, setShared] = useState<SharedLink | null>(null);

  return (
    <>
      {!canManage && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Adding and removing users only works on the live site, where the server key is set.
        </p>
      )}

      <div className="mb-4 flex justify-end">
        <button type="button" disabled={!canManage} onClick={() => setAdding(true)} className={buttonClass("primary")}>
          <UserPlus className="h-4 w-4" strokeWidth={2} />
          Add user
        </button>
      </div>

      <ul aria-label="Users" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {users.map((user) => (
          <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} canManage={canManage} onLink={setShared} />
        ))}
      </ul>

      {adding && (
        <AddUserDialog
          onCreated={(name) => {
            setAdding(false);
            toast(`${name} can sign in now.`);
          }}
          onClosed={() => setAdding(false)}
          onAdded={(link) => {
            setAdding(false);
            setShared(link);
          }}
        />
      )}
      {shared && <ShareLinkDialog shared={shared} onClosed={() => setShared(null)} />}
    </>
  );
}

function UserRow({ user, isSelf, canManage, onLink }: { user: AdminUser; isSelf: boolean; canManage: boolean; onLink: (link: SharedLink) => void }) {
  const { confirm, toast, promptText } = useFeedback();
  const [settingPassword, setSettingPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const name = personName(user.fullName, user.email, "Unnamed user");
  const status = user.status === "unknown" ? null : STATUS[user.status];

  function run(action: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) toast(result.error, "error");
        else toast(success);
      } catch {
        toast("That didn't work. Please try again.", "error");
      }
    });
  }

  function getLink() {
    startTransition(async () => {
      try {
        const result = await createUserLink(user.id);
        if (result.link) onLink({ name, email: user.email, link: result.link, isNew: false });
        else toast(result.error ?? "The link wasn't created. Please try again.", "error");
      } catch {
        toast("The link wasn't created. Please try again.", "error");
      }
    });
  }

  async function remove() {
    const confirmed = await confirm({
      title: `Remove ${name}?`,
      body: "They won't be able to sign in. Their leads, deals and history stay, and you can restore them later.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (confirmed) run(() => setUserAccess(user.id, false), `${name} was removed.`);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {getInitials(name)}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium text-slate-900">
          {name}
          {isSelf && <span className="font-normal text-slate-500"> (you)</span>}
        </p>
        {user.email && user.email !== name && <p className="truncate text-sm text-slate-600">{user.email}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {user.role !== "admin" && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-800">No admin access</span>}
        {status && <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>{status.label}</span>}
        {user.status === "active" && user.lastSignInAt && <span className="text-slate-600">Last sign-in {lastSignIn.format(new Date(user.lastSignInAt))}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        <button
          type="button"
          disabled={isPending}
          aria-label={`Edit the name for ${name}`}
          onClick={async () => {
            const next = await promptText({ title: user.fullName ? `Edit ${name}'s name` : "Add their name", label: "First and last name", confirmLabel: "Save name" });
            if (next !== null) run(() => setUserName(user.id, next), "Name saved.");
          }}
          className={buttonClass(user.fullName ? "ghost" : "secondary", "sm")}
        >
          {user.fullName ? "Edit name" : "Add name"}
        </button>
        {user.role !== "admin" && user.status !== "removed" && (
          <button type="button" disabled={isPending} onClick={() => run(() => giveAdminAccess(user.id), `${name} now has admin access.`)} className={buttonClass("secondary", "sm")}>
            Give admin access
          </button>
        )}
        {canManage && user.status !== "removed" && (
          <button type="button" disabled={isPending} aria-label={`Set a password for ${name}`} onClick={() => setSettingPassword(true)} className={buttonClass("secondary", "sm")}>
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
            Set password
          </button>
        )}
        {canManage && user.status !== "removed" && (
          <button type="button" disabled={isPending} aria-label={`Get a sign-in link for ${name}`} onClick={getLink} className={buttonClass("secondary", "sm")}>
            Get link
          </button>
        )}
        {canManage && !isSelf && user.status !== "removed" && (
          <button type="button" disabled={isPending} aria-label={`Remove ${name}`} onClick={remove} className={buttonClass("ghost", "sm")}>
            Remove
          </button>
        )}
        {canManage && user.status === "removed" && (
          <button type="button" disabled={isPending} aria-label={`Restore ${name}`} onClick={() => run(() => setUserAccess(user.id, true), `${name} can sign in again.`)} className={buttonClass("secondary", "sm")}>
            Restore
          </button>
        )}
      </div>
      {settingPassword && <SetPasswordDialog userId={user.id} name={name} onClosed={() => setSettingPassword(false)} />}
    </li>
  );
}

function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return ref;
}

/** A password field with a show/hide toggle. */
function PasswordField({ value, onChange, label = "Password", autoFocus = false }: { value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="mt-3 block text-sm font-medium text-slate-700">
      {label}
      <span className="relative mt-1 block">
        <input
          type={shown ? "text" : "password"}
          autoFocus={autoFocus}
          autoComplete="new-password"
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} mt-0 pr-10`}
        />
        <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800">
          {shown ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
        </button>
      </span>
    </label>
  );
}

function AddUserDialog({ onClosed, onAdded, onCreated }: { onClosed: () => void; onAdded: (link: SharedLink) => void; onCreated: (name: string) => void }) {
  const dialogRef = useModal();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const name = `${first.trim()} ${last.trim()}`.trim();

  return (
    <dialog ref={dialogRef} aria-labelledby="add-user-title" onClose={onClosed} className={DIALOG}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startSaving(async () => {
            try {
              const result = await addUser({ firstName: first, lastName: last, email, password });
              if (result.error) setError(result.error);
              else if (result.created) onCreated(name);
              else if (result.link) onAdded({ name, email: email.trim(), link: result.link, isNew: true });
              else setError("That user wasn't added. Please try again.");
            } catch {
              setError("That user wasn't added. Please try again.");
            }
          });
        }}
      >
        <h2 id="add-user-title" className="text-lg font-semibold text-slate-900">Add user</h2>
        <p className="mt-1 text-sm text-slate-600">They&apos;ll have full access to Catapult. Set a password to share with them, or leave it blank to get a link they use to set their own.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            First name
            <input autoFocus required autoComplete="off" value={first} onChange={(e) => setFirst(e.target.value)} className={FIELD} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Last name
            <input required autoComplete="off" value={last} onChange={(e) => setLast(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Email
          <input required type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </label>
        <PasswordField value={password} onChange={setPassword} label="Password (optional)" />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters. Share it with them privately.</p>

        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("secondary")}>Cancel</button>
          <button type="submit" disabled={isSaving} className={buttonClass("primary")}>{isSaving ? "Adding..." : password ? "Create user" : "Create user and get link"}</button>
        </div>
      </form>
    </dialog>
  );
}

function SetPasswordDialog({ userId, name, onClosed }: { userId: string; name: string; onClosed: () => void }) {
  const dialogRef = useModal();
  const { toast } = useFeedback();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  return (
    <dialog ref={dialogRef} aria-labelledby="set-password-title" onClose={onClosed} className={DIALOG}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startSaving(async () => {
            try {
              const result = await setUserPassword(userId, password);
              if (result.error) return setError(result.error);
              toast(`${name}'s password was changed.`);
              dialogRef.current?.close();
            } catch {
              setError("The password wasn't changed. Please try again.");
            }
          });
        }}
      >
        <h2 id="set-password-title" className="text-lg font-semibold text-slate-900">Set {name}&apos;s password</h2>
        <p className="mt-1 text-sm text-slate-600">They can sign in with it straight away. Share it with them privately.</p>
        <PasswordField value={password} onChange={setPassword} label="New password" autoFocus />
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("secondary")}>Cancel</button>
          <button type="submit" disabled={isSaving || password.length < 8} className={buttonClass("primary")}>{isSaving ? "Saving..." : "Set password"}</button>
        </div>
      </form>
    </dialog>
  );
}

function ShareLinkDialog({ shared, onClosed }: { shared: SharedLink; onClosed: () => void }) {
  const dialogRef = useModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const subject = "Your Catapult CRM access";
  const body = `Hi ${shared.name},\n\nUse this link to set your Catapult CRM password. It works once and expires soon:\n\n${shared.link}`;
  const mailto = `mailto:${encodeURIComponent(shared.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shared.link);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
      inputRef.current?.select();
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="share-link-title" onClose={onClosed} className={DIALOG}>
      <h2 id="share-link-title" className="text-lg font-semibold text-slate-900">{shared.isNew ? `${shared.name} was added` : `Link for ${shared.name}`}</h2>
      <p className="mt-1 text-sm text-slate-600">Send them this link so they can set a password. It works once and usually expires within an hour. You can get a new one from the list.</p>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Sign-in link
        <input ref={inputRef} readOnly value={shared.link} onFocus={(e) => e.target.select()} className={`${FIELD} bg-slate-50 text-slate-700`} />
      </label>
      <p role="status" className="mt-1 min-h-5 text-sm text-slate-600">
        {copied ? "Copied." : copyFailed ? "Couldn't copy. The link is selected, so press Command+C." : ""}
      </p>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <a href={mailto} className={buttonClass("secondary")}>
          <Mail className="h-4 w-4" strokeWidth={2} />
          Open in email
        </a>
        <button type="button" onClick={copy} className={buttonClass("secondary")}>
          {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
          Copy link
        </button>
        <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("primary")}>Done</button>
      </div>
    </dialog>
  );
}
