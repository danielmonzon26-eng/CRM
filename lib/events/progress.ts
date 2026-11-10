/**
 * How registrations are tracking against an event's target and maximum, with a plain read
 * for deciding whether to promote it more. Worked out on the server (it depends on today),
 * then passed to the page so it renders the same everywhere.
 */
export type RegistrationProgress = {
  registered: number;
  waitlisted: number;
  target: number | null;
  capacity: number | null;
  /** Registered as a % of the target, uncapped (110 means 10% over). */
  percentOfTarget: number | null;
  percentOfCapacity: number | null;
  /** Where registrations should be by now if they came in evenly since the event was created. */
  expectedNow: number | null;
  daysToGo: number;
  status: "no_target" | "on_track" | "behind" | "reached" | "full" | "ended";
  label: string;
  detail: string;
  tone: string;
};

const DAY_MS = 86_400_000;
// Behind when under three-quarters of the even-pace number, once within 6 weeks of the event.
const BEHIND_RATIO = 0.75;
const WATCH_WINDOW_DAYS = 42;

export function registrationProgress(input: {
  registered: number;
  waitlisted?: number;
  target: number | null;
  capacity: number | null;
  createdAt: string;
  startsAt: string;
  now?: Date;
}): RegistrationProgress {
  const now = input.now ?? new Date();
  const start = new Date(input.startsAt).getTime();
  const created = Math.min(new Date(input.createdAt).getTime(), start);
  const daysToGo = Math.max(0, Math.ceil((start - now.getTime()) / DAY_MS));
  const { registered, target, capacity } = input;
  const percentOfTarget = target ? Math.round((registered / target) * 100) : null;
  const percentOfCapacity = capacity ? Math.min(100, Math.round((registered / capacity) * 100)) : null;
  const elapsed = start > created ? Math.min(1, Math.max(0, (now.getTime() - created) / (start - created))) : 1;
  const expectedNow = target ? Math.round(target * elapsed) : null;
  const base = { registered, waitlisted: input.waitlisted ?? 0, target, capacity, percentOfTarget, percentOfCapacity, expectedNow, daysToGo };
  const toGo = daysToGo === 0 ? "today" : daysToGo === 1 ? "1 day to go" : `${daysToGo} days to go`;

  if (now.getTime() >= start) {
    return {
      ...base,
      status: "ended",
      label: target ? `${percentOfTarget}% of target` : `${registered} registered`,
      detail: target ? `Finished with ${registered} of ${target}.` : "Event has started.",
      tone: "bg-slate-100 text-slate-700",
    };
  }
  if (capacity && registered >= capacity) {
    return { ...base, status: "full", label: "Full", detail: `All ${capacity} spots taken${base.waitlisted ? `, ${base.waitlisted} on the waitlist` : ""}. ${toGo}.`, tone: "bg-violet-50 text-violet-800" };
  }
  if (!target) {
    return { ...base, status: "no_target", label: `${registered} registered`, detail: `Set a target to track promotion. ${toGo}.`, tone: "bg-slate-100 text-slate-700" };
  }
  if (registered >= target) {
    return { ...base, status: "reached", label: "Target reached", detail: `${registered} of ${target}. ${toGo}.`, tone: "bg-emerald-50 text-emerald-800" };
  }
  const behind = daysToGo <= WATCH_WINDOW_DAYS && expectedNow !== null && registered < expectedNow * BEHIND_RATIO;
  const needed = target - registered;
  return behind
    ? {
        ...base,
        status: "behind",
        label: "Behind pace",
        detail: `${needed} more needed, ${toGo}. Even pace would be about ${expectedNow} by now. Time to promote.`,
        tone: "bg-amber-50 text-amber-900",
      }
    : {
        ...base,
        status: "on_track",
        label: "On track",
        detail: `${needed} more to reach the target, ${toGo}.`,
        tone: "bg-sky-50 text-sky-800",
      };
}
