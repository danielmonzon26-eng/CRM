"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Circle, Globe, ImagePlus, Loader2, MessageSquareWarning, RefreshCw, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { deletePost, savePost, setPostStatus, type PostInput } from "@/app/actions/marketing";
import { PlatformIcon } from "@/components/marketing/platform-icon";
import { PostStatusPill } from "@/components/marketing/status-pill";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { autoRequestLabel, countHashtags, IMAGE_TYPES, INSTAGRAM_HASHTAG_LIMIT, MAX_IMAGE_BYTES, PLATFORMS, PLATFORM_META, readinessIssues } from "@/lib/marketing/constants";
import type { Channel, PostItem } from "@/lib/marketing/queries";
import { uploadPostImage } from "@/lib/marketing/upload";
import type { SocialPlatform } from "@/lib/supabase/types";

const FIELD =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
const LABEL = "block text-sm font-medium text-slate-700";
const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

type Image = { path: string; name: string; previewUrl: string } | null;

type Values = {
  title: string;
  caption: string;
  initiativeId: string;
  date: string;
  time: string;
  channelIds: string[];
};

function initialValues(post: PostItem | null, defaults: { date: string; initiativeId: string }, channels: Channel[]): Values {
  if (post) {
    const [date = "", time = ""] = post.scheduledInput.split("T");
    return {
      title: post.title,
      caption: post.caption,
      initiativeId: post.initiative?.id ?? "",
      date,
      time,
      channelIds: post.channels.map((c) => c.id),
    };
  }
  return {
    title: "",
    caption: "",
    initiativeId: defaults.initiativeId,
    date: defaults.date,
    time: defaults.date ? "09:00" : "",
    // A new post starts on every main channel; untick the ones it shouldn't go to.
    channelIds: channels.filter((c) => c.active).map((c) => c.id),
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function PostComposer({
  post,
  channels,
  initiatives,
  isAdmin,
  userId,
  defaults,
}: {
  post: PostItem | null;
  channels: Channel[];
  initiatives: { id: string; name: string }[];
  isAdmin: boolean;
  userId: string;
  defaults: { date: string; initiativeId: string };
}) {
  const router = useRouter();
  const { toast, confirm, promptText } = useFeedback();
  const initial = useMemo(() => initialValues(post, defaults, channels), [post, defaults, channels]);
  const [values, setValues] = useState<Values>(initial);
  const initialImage: Image = post?.imagePath ? { path: post.imagePath, name: post.imageName ?? "Image", previewUrl: post.imageUrl ?? "" } : null;
  const [image, setImage] = useState<Image>(initialImage);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "submit" | "approve" | "back" | "delete" | null>(null);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

  const selected = channels.filter((c) => values.channelIds.includes(c.id));
  const platforms = [...new Set(selected.map((c) => c.platform))] as SocialPlatform[];
  const issues = readinessIssues({ caption: values.caption, platforms, hasImage: !!image });
  const imageChanged = (image?.path ?? null) !== (initialImage?.path ?? null);
  const dirty =
    !post ||
    values.title !== initial.title ||
    values.caption !== initial.caption ||
    values.initiativeId !== initial.initiativeId ||
    values.date !== initial.date ||
    values.time !== initial.time ||
    !sameSet(values.channelIds, initial.channelIds) ||
    imageChanged;
  const status = post?.status ?? "requested";
  const canDelete = !!post && (isAdmin || post.createdBy === userId);
  const contentChanged =
    !!post && (values.title !== initial.title || values.caption !== initial.caption || imageChanged || !sameSet(values.channelIds, initial.channelIds));

  // Warn before leaving with unsaved work.
  const dirtyRef = useRef(false);
  dirtyRef.current = !!post && dirty;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setImageError("Use a JPG, PNG, WebP or GIF image.");
    if (file.size > MAX_IMAGE_BYTES) return setImageError("Images can be up to 10 MB.");
    setUploading(true);
    const result = await uploadPostImage(file).catch(() => ({ error: "The image didn't upload. Please try again." }));
    setUploading(false);
    if ("error" in result) return setImageError(result.error);
    setImage({ ...result, previewUrl: URL.createObjectURL(file) });
  }

  function run(kind: "save" | "submit" | "approve") {
    setError(null);
    if (!values.title.trim()) {
      setError("Give the post a short title, so the team can find it.");
      return;
    }
    if (values.date && !values.time) set({ time: "09:00" });
    const input: PostInput = {
      id: post?.id ?? null,
      title: values.title,
      caption: values.caption,
      initiativeId: values.initiativeId || null,
      scheduledAt: values.date ? `${values.date}T${values.time || "09:00"}` : "",
      channelIds: values.channelIds,
      intent: kind,
      ...(post ? (imageChanged ? { image: image ? { path: image.path, name: image.name } : null } : {}) : { image: image ? { path: image.path, name: image.name } : null }),
    };
    setBusy(kind);
    startTransition(async () => {
      const result = await savePost(input).catch(() => ({ error: "That didn't save. Please try again.", id: undefined }));
      setBusy(null);
      if (result.error) {
        setError(result.error);
        if (result.id && !post) router.replace(`/marketing/posts/${result.id}`);
        return;
      }
      dirtyRef.current = false;
      toast(kind === "approve" ? "Approved. It's good to post." : kind === "submit" ? "Submitted for approval." : post ? "Changes saved." : "Post saved as a request.");
      if (!post && result.id) router.replace(`/marketing/posts/${result.id}`);
      else router.refresh();
    });
  }

  async function sendBack() {
    if (!post) return;
    const note = await promptText({ title: `Send back "${post.title}"`, label: "What needs to change?", confirmLabel: "Send back" });
    if (note === null) return;
    setBusy("back");
    startTransition(async () => {
      const result = await setPostStatus(post.id, "requested", note).catch(() => ({ error: "That didn't save. Please try again." }));
      setBusy(null);
      if (result.error) setError(result.error);
      else {
        toast("Sent back with your note.");
        router.refresh();
      }
    });
  }

  async function remove() {
    if (!post) return;
    const ok = await confirm({ title: `Delete "${post.title}"?`, body: "The post and its image are removed for everyone. This can't be undone.", confirmLabel: "Delete post", danger: true });
    if (!ok) return;
    setBusy("delete");
    startTransition(async () => {
      const result = await deletePost(post.id).catch(() => ({ error: "That post wasn't deleted. Please try again." }));
      setBusy(null);
      if (result.error) setError(result.error);
      else {
        dirtyRef.current = false;
        toast("Post deleted.");
        router.push("/marketing/social/approvals");
      }
    });
  }

  const byPlatform = PLATFORMS.map((p) => ({ ...p, channels: channels.filter((c) => c.platform === p.key) })).filter((p) => p.channels.length > 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run("save");
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/marketing/social/approvals" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          All posts
        </Link>
        {post && (
          <p className="text-xs text-slate-500">
            {post.createdByName ? `Created by ${post.createdByName} · ` : ""}Last changed {post.updatedLabel}
          </p>
        )}
      </div>

      <StatusBanner post={post} isAdmin={isAdmin} contentChanged={contentChanged} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <section className={`${CARD} space-y-4 p-4 sm:p-5`} aria-labelledby="post-details">
            <h2 id="post-details" className="text-sm font-semibold text-slate-900">
              Details
            </h2>
            <label className={LABEL}>
              Title <span className="text-brand-600">*</span>
              <input
                required
                maxLength={200}
                value={values.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. Founders Breakfast: last call to register"
                className={FIELD}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">For the team only. It isn&apos;t posted.</span>
            </label>
            <label className={LABEL}>
              Initiative
              <select value={values.initiativeId} onChange={(e) => set({ initiativeId: e.target.value })} className={FIELD}>
                <option value="">Not part of an initiative</option>
                {initiatives.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={`${CARD} space-y-3 p-4 sm:p-5`} aria-labelledby="post-content">
            <h2 id="post-content" className="text-sm font-semibold text-slate-900">
              Content
            </h2>
            <label className={LABEL}>
              Caption
              <textarea
                rows={8}
                value={values.caption}
                onChange={(e) => set({ caption: e.target.value })}
                placeholder={"What do you want to say? Add links and #hashtags as you would on the platform."}
                className={`${FIELD} resize-y leading-relaxed`}
              />
            </label>
            <CaptionMeters caption={values.caption} platforms={platforms} />

            <div>
              <p className={LABEL}>Image</p>
              {image ? (
                <div className="mt-1 flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                  {image.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.previewUrl} alt="The post's image" className="h-20 w-20 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">No preview</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{image.name}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <label className={`${buttonClass("secondary", "sm")} cursor-pointer`}>
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                        Replace
                        <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => void chooseImage(e.target.files?.[0])} />
                      </label>
                      <button type="button" onClick={() => setImage(null)} className={buttonClass("ghost", "sm")}>
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void chooseImage(e.dataTransfer.files[0]);
                  }}
                  className="mt-1 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300"
                >
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-brand-600" strokeWidth={2} /> : <ImagePlus className="h-6 w-6 text-slate-400" strokeWidth={1.75} />}
                  <span className="text-sm font-medium text-slate-800">{uploading ? "Uploading..." : "Drop an image here, or choose one"}</span>
                  <span className="text-xs text-slate-500">JPG, PNG, WebP or GIF, up to 10 MB. Square (1080 × 1080) works on every platform.</span>
                  <input type="file" accept={IMAGE_TYPES.join(",")} disabled={uploading} className="sr-only" onChange={(e) => void chooseImage(e.target.files?.[0])} />
                </label>
              )}
              {imageError && (
                <p role="alert" className="mt-1.5 text-sm text-rose-700">
                  {imageError}
                </p>
              )}
            </div>
          </section>

          <section className={`${CARD} space-y-3 p-4 sm:p-5`} aria-labelledby="post-channels">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="post-channels" className="text-sm font-semibold text-slate-900">
                Channels
              </h2>
              {isAdmin && (
                <Link href="/marketing/social/channels" className="text-xs font-medium text-brand-700 hover:underline">
                  Manage channels
                </Link>
              )}
            </div>
            {byPlatform.length === 0 ? (
              <p className="text-sm text-slate-500">No channels yet. An admin can add them under Channels.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {byPlatform.map((p) => (
                  <fieldset key={p.key} className="rounded-lg border border-slate-200 p-3">
                    <legend className="sr-only">{p.label}</legend>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <PlatformIcon platform={p.key} className="h-4 w-4" title="" />
                      {p.label}
                    </p>
                    <ul className="space-y-1.5">
                      {p.channels.map((c) => {
                        const on = values.channelIds.includes(c.id);
                        return (
                          <li key={c.id}>
                            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => set({ channelIds: on ? values.channelIds.filter((x) => x !== c.id) : [...values.channelIds, c.id] })}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                              />
                              <span className="min-w-0">
                                <span className="block truncate">{c.name}</span>
                                {c.handle && <span className="block truncate text-xs text-slate-500">@{c.handle}</span>}
                                {!c.active && <span className="block text-xs text-amber-700">No longer active</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} space-y-3 p-4 sm:p-5`} aria-labelledby="post-schedule">
            <h2 id="post-schedule" className="text-sm font-semibold text-slate-900">
              Schedule
            </h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
              <label className={LABEL}>
                Date
                <input type="date" value={values.date} onChange={(e) => set({ date: e.target.value, time: e.target.value && !values.time ? "09:00" : values.time })} className={FIELD} />
              </label>
              <label className={LABEL}>
                Time (Calgary)
                <input type="time" step={900} value={values.time} disabled={!values.date} onChange={(e) => set({ time: e.target.value })} className={`${FIELD} disabled:bg-slate-50`} />
              </label>
              {values.date && (
                <button type="button" onClick={() => set({ date: "", time: "" })} className={`${buttonClass("ghost", "sm")} mb-1`}>
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Leave it blank to keep it as an idea; it waits under Not scheduled yet on the planner.</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Preview platforms={platforms} caption={values.caption} image={image} channels={selected} />
          <Readiness issues={issues} status={status} />
        </aside>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {canDelete && (
          <button type="button" disabled={pending} onClick={remove} className={`${buttonClass("ghost")} text-rose-700 hover:bg-rose-50`}>
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            {busy === "delete" ? "Deleting..." : "Delete"}
          </button>
        )}
        <span role="status" className="mr-auto text-xs text-slate-500">
          {uploading ? "Uploading the image..." : post ? (dirty ? "Unsaved changes" : "All changes saved") : "New post"}
        </span>

        {isAdmin && status === "waiting_approval" && (
          <button type="button" disabled={pending || dirty} title={dirty ? "Save your changes first" : undefined} onClick={sendBack} className={buttonClass("ghost")}>
            <Undo2 className="h-4 w-4" strokeWidth={2} />
            {busy === "back" ? "Sending back..." : "Send back"}
          </button>
        )}
        <button type="submit" disabled={pending || uploading || (!!post && !dirty)} className={buttonClass("secondary")}>
          {busy === "save" ? "Saving..." : post ? "Save changes" : "Save as request"}
        </button>
        {status === "requested" && !isAdmin && (
          <button type="button" disabled={pending || uploading || issues.length > 0} title={issues[0]} onClick={() => run("submit")} className={buttonClass("primary")}>
            {busy === "submit" ? "Submitting..." : "Submit for approval"}
          </button>
        )}
        {isAdmin && status !== "approved" && (
          <button type="button" disabled={pending || uploading || issues.length > 0} title={issues[0]} onClick={() => run("approve")} className={buttonClass("primary")}>
            <Check className="h-4 w-4" strokeWidth={2.25} />
            {busy === "approve" ? "Approving..." : dirty ? "Save and approve" : "Approve"}
          </button>
        )}
      </div>
    </form>
  );
}

function StatusBanner({ post, isAdmin, contentChanged }: { post: PostItem | null; isAdmin: boolean; contentChanged: boolean }) {
  if (!post) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-card">
        <PostStatusPill status="requested" />
        New posts start as a request. Fill it in, then submit it for approval.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-card">
        <PostStatusPill status={post.status} />
        {post.status === "requested" && <span>Being written. Submit it when it&apos;s ready.</span>}
        {post.status === "waiting_approval" && (
          <span>
            Submitted {post.submittedLabel} · {isAdmin ? "Approve it, or send it back with a note." : "An admin will review it."}
          </span>
        )}
        {post.status === "approved" && (
          <span>
            Approved{post.approvedByName ? ` by ${post.approvedByName}` : ""}
            {post.approvedLabel ? `, ${post.approvedLabel}` : ""} · Good to post.
          </span>
        )}
      </div>
      {post.event && post.autoDaysBefore && (
        <p className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
          <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            Requested automatically, {autoRequestLabel(post.autoDaysBefore)}{" "}
            <Link href={`/events/${post.event.id}`} className="font-medium underline">
              {post.event.title}
            </Link>
            . It moves if the event&apos;s date changes. Add channels and an image, then submit it.
          </span>
        </p>
      )}
      {post.status === "requested" && post.reviewNote && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <MessageSquareWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-medium">Sent back:</span> {post.reviewNote}
          </span>
        </p>
      )}
      {post.status === "approved" && !isAdmin && contentChanged && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Saving changes to the words, image or channels sends this post back for approval. Changing only the date doesn&apos;t.
        </p>
      )}
    </div>
  );
}

function CaptionMeters({ caption, platforms }: { caption: string; platforms: SocialPlatform[] }) {
  if (platforms.length === 0) return null;
  const length = caption.length;
  const hashtags = countHashtags(caption);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Caption length on each platform">
      {platforms.map((p) => {
        const { limit, label } = PLATFORM_META[p];
        const ratio = length / limit;
        const tone = ratio > 1 ? "text-rose-700 font-medium" : ratio > 0.9 ? "text-amber-700" : "text-slate-500";
        return (
          <li key={p} className={`inline-flex items-center gap-1.5 ${tone}`}>
            <PlatformIcon platform={p} className="h-3.5 w-3.5" title="" />
            <span>
              <span className="tabular-nums">{length.toLocaleString("en-CA")}</span> / {limit.toLocaleString("en-CA")}
              <span className="sr-only"> characters on {label}</span>
            </span>
          </li>
        );
      })}
      {platforms.includes("instagram") && (
        <li className={hashtags > INSTAGRAM_HASHTAG_LIMIT ? "font-medium text-rose-700" : "text-slate-500"}>
          {hashtags} / {INSTAGRAM_HASHTAG_LIMIT} hashtags
        </li>
      )}
    </ul>
  );
}

function Readiness({ issues, status }: { issues: string[]; status: string }) {
  if (status === "approved") return null;
  return (
    <section aria-labelledby="ready-title" className={`${CARD} p-4`}>
      <h2 id="ready-title" className="text-sm font-semibold text-slate-900">
        Ready for approval?
      </h2>
      {issues.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          Everything&apos;s in place.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" strokeWidth={2} />
              {i}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Roughly how the post will look on each selected platform. */
function Preview({ platforms, caption, image, channels }: { platforms: SocialPlatform[]; caption: string; image: Image; channels: Channel[] }) {
  const [tab, setTab] = useState<SocialPlatform | null>(null);
  const active = tab && platforms.includes(tab) ? tab : platforms[0] ?? null;
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-labelledby="preview-title" className={CARD}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 id="preview-title" className="text-sm font-semibold text-slate-900">
          Preview
        </h2>
        {platforms.length > 1 && (
          <div role="tablist" aria-label="Preview platform" className="flex gap-1">
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === active}
                onClick={() => setTab(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${p === active ? "border-brand-500 bg-brand-50" : "border-transparent hover:bg-slate-100"}`}
              >
                <PlatformIcon platform={p} className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
      </header>
      {!active ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Choose a channel to see a preview.</p>
      ) : (
        <div className="p-3">
          <PostMock
            platform={active}
            account={channels.find((c) => c.platform === active)?.name.replace(/ on (LinkedIn|Facebook|Instagram)$/i, "") || "Catapult"}
            caption={caption}
            image={image}
            expanded={expanded}
            onExpand={() => setExpanded((e) => !e)}
          />
          <p className="mt-2 text-center text-[11px] text-slate-400">An approximation; each platform has the final say on layout.</p>
        </div>
      )}
    </section>
  );
}

function PostMock({
  platform,
  account,
  caption,
  image,
  expanded,
  onExpand,
}: {
  platform: SocialPlatform;
  account: string;
  caption: string;
  image: Image;
  expanded: boolean;
  onExpand: () => void;
}) {
  const fold = PLATFORM_META[platform].foldAt;
  const long = caption.length > fold;
  const shown = expanded || !long ? caption : `${caption.slice(0, fold).trimEnd()}…`;
  const text = caption ? (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-slate-800">
      {platform === "instagram" && <span className="mr-1 font-semibold">{account.toLowerCase().replace(/\s+/g, "")}</span>}
      {shown}{" "}
      {long && (
        <button type="button" onClick={onExpand} className="font-medium text-slate-500 hover:underline">
          {expanded ? "less" : platform === "instagram" ? "more" : "see more"}
        </button>
      )}
    </p>
  ) : (
    <p className="text-[13px] italic text-slate-400">Your caption shows here.</p>
  );
  const picture = image?.previewUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.previewUrl} alt="" className={`w-full bg-slate-100 object-cover ${platform === "instagram" ? "aspect-square" : "max-h-80"}`} />
  ) : platform === "instagram" ? (
    <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-500">Instagram needs an image</div>
  ) : null;

  const header = (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className={`flex h-9 w-9 items-center justify-center bg-brand-600 text-sm font-semibold text-white ${platform === "linkedin" ? "rounded-md" : "rounded-full"}`}>
        {account.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-semibold text-slate-900">{platform === "instagram" ? account.toLowerCase().replace(/\s+/g, "") : account}</p>
        {platform !== "instagram" && (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            Now · <Globe className="h-3 w-3" strokeWidth={2} />
          </p>
        )}
      </div>
      <PlatformIcon platform={platform} className="ml-auto h-4 w-4" />
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {header}
      {platform === "instagram" ? (
        <>
          {picture}
          <div className="px-3 py-2.5">{text}</div>
        </>
      ) : (
        <>
          <div className="px-3 pb-2.5">{text}</div>
          {picture}
          <div className="flex justify-around border-t border-slate-100 px-2 py-2 text-[11px] font-medium text-slate-500">
            <span>Like</span>
            <span>Comment</span>
            <span>{platform === "linkedin" ? "Repost" : "Share"}</span>
          </div>
        </>
      )}
    </div>
  );
}
