import type { RegistrationProgress } from "@/lib/events/progress";

const FILL: Record<RegistrationProgress["status"], string> = {
  no_target: "bg-slate-400",
  on_track: "bg-sky-500",
  behind: "bg-amber-500",
  reached: "bg-emerald-500",
  full: "bg-violet-500",
  ended: "bg-slate-400",
};

/** A registrations bar with the target marked; the right end is the max (or the target if there's no max). */
export function RegistrationBar({ progress, size = "md" }: { progress: RegistrationProgress; size?: "sm" | "md" }) {
  const scale = Math.max(progress.capacity ?? 0, progress.target ?? 0, progress.registered, 1);
  const fill = Math.min(100, (progress.registered / scale) * 100);
  const targetAt = progress.target && progress.capacity ? (progress.target / scale) * 100 : null;
  const label = [
    `${progress.registered} registered`,
    progress.target ? `target ${progress.target}` : null,
    progress.capacity ? `max ${progress.capacity}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={progress.registered}
      aria-valuemin={0}
      aria-valuemax={scale}
      className={`relative overflow-visible rounded-full bg-slate-100 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      <div className={`h-full rounded-full ${FILL[progress.status]}`} style={{ width: `${fill}%` }} />
      {targetAt !== null && targetAt < 100 && (
        <span
          aria-hidden="true"
          title={`Target ${progress.target}`}
          className={`absolute top-1/2 w-0.5 -translate-y-1/2 rounded bg-ink-950 ${size === "sm" ? "h-3" : "h-4"}`}
          style={{ left: `${targetAt}%` }}
        />
      )}
    </div>
  );
}

/** The full panel for an event page: numbers, bar, status and what to do. */
export function RegistrationPanel({ progress }: { progress: RegistrationProgress }) {
  return (
    <section aria-labelledby="registration-progress-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="registration-progress-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Registrations vs target
          </h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {progress.percentOfTarget !== null ? `${progress.percentOfTarget}%` : progress.registered}
            </span>
            <span className="text-sm text-slate-600">
              {progress.target ? `${progress.registered} of ${progress.target} target` : "registered, no target set"}
              {progress.capacity ? ` · max ${progress.capacity}` : ""}
              {progress.waitlisted ? ` · ${progress.waitlisted} waitlisted` : ""}
            </span>
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${progress.tone}`}>{progress.label}</span>
      </div>
      <div className="mt-4">
        <RegistrationBar progress={progress} />
        <div className="relative mt-1.5 h-4 text-[11px] text-slate-500">
          <span className="absolute left-0">0</span>
          {progress.target && progress.capacity && progress.target < progress.capacity && (
            // Sits under the marker, kept clear of the ends so labels don't overlap.
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-slate-700" style={{ left: `${Math.min(85, Math.max(15, (progress.target / Math.max(progress.capacity, progress.registered)) * 100))}%` }}>
              Target {progress.target}
            </span>
          )}
          <span className="absolute right-0">{progress.capacity ? `Max ${progress.capacity}` : progress.target ? `Target ${progress.target}` : ""}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-700">{progress.detail}</p>
    </section>
  );
}
