import type { MarketingStream } from "@/lib/budgets/marketing-items";
import { getItemOptions, getMarketingItems, type ItemOptions, type MarketingItem } from "@/lib/marketing/items-queries";
import { createClient } from "@/lib/supabase/server";

export type LineSummary = {
  id: string;
  name: string;
  budgetName: string;
  /** The line's budget (for an event line, the total of all its costs). */
  amount: number;
  /** Everything booked on the line: marketing items and other costs. */
  booked: number;
  /** The marketing items' share. */
  marketing: number;
  isEventLine: boolean;
};

export type StreamGroup = {
  key: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  line: LineSummary | null;
  items: MarketingItem[];
  /** Starting values for a new item added in this group. */
  defaults: { stream: MarketingStream; eventId?: string; budgetLineId?: string; sponsorId?: string; sponsorName?: string };
  warning: string | null;
};

async function lineSummaries(lineIds: string[]): Promise<Map<string, LineSummary>> {
  if (lineIds.length === 0) return new Map();
  const supabase = await createClient();
  const [{ data: lines, error }, { data: items, error: itemsError }, { data: mItems, error: mError }, { data: budgets, error: bError }] = await Promise.all([
    supabase.from("budget_lines").select("id, name, amount, budget_id, event_id").in("id", lineIds),
    supabase.from("budget_items").select("line_id, amount").in("line_id", lineIds),
    supabase.from("marketing_items").select("budget_line_id, amount").in("budget_line_id", lineIds),
    supabase.from("budgets").select("id, name"),
  ]);
  for (const e of [error, itemsError, mError, bError]) if (e) throw e;
  const budgetName = new Map((budgets ?? []).map((b) => [b.id, b.name]));
  return new Map(
    (lines ?? []).map((l) => [
      l.id,
      {
        id: l.id,
        name: l.name,
        budgetName: budgetName.get(l.budget_id) ?? "Budget",
        amount: Number(l.amount),
        booked: (items ?? []).filter((i) => i.line_id === l.id).reduce((s, i) => s + Number(i.amount), 0),
        marketing: (mItems ?? []).filter((m) => m.budget_line_id === l.id).reduce((s, m) => s + Number(m.amount), 0),
        isEventLine: !!l.event_id,
      },
    ]),
  );
}

/** One stream's marketing, grouped the way that stream is managed. */
export async function getStream(stream: MarketingStream): Promise<{ groups: StreamGroup[]; options: ItemOptions }> {
  const [all, options] = await Promise.all([getMarketingItems(), getItemOptions()]);
  const items = all.filter((i) => i.stream === stream);

  if (stream === "event") {
    const lines = await lineSummaries(options.events.map((e) => e.lineId).filter((x): x is string => !!x));
    const today = new Date().toISOString().slice(0, 10);
    const groups = options.events
      .map((e): StreamGroup => {
        const mine = items.filter((i) => i.event?.id === e.id);
        return {
          key: e.id,
          title: e.title,
          subtitle: e.whenLabel,
          href: `/events/${e.id}?tab=budget`,
          line: e.lineId ? lines.get(e.lineId) ?? null : null,
          items: mine,
          defaults: { stream: "event", eventId: e.id, budgetLineId: e.lineId ?? undefined },
          warning: e.lineId ? null : "No budget line yet. Set it up on the event's Budget tab, then add marketing items here.",
        };
      })
      // Upcoming events first; past ones only if they have marketing items.
      .filter((g) => g.items.length > 0 || (options.events.find((e) => e.id === g.key)?.day ?? "") >= today);
    return { groups, options };
  }

  if (stream === "sponsorship") {
    const bySponsor = new Map<string, MarketingItem[]>();
    for (const i of items) bySponsor.set(i.sponsor?.id ?? "none", [...(bySponsor.get(i.sponsor?.id ?? "none") ?? []), i]);
    const groups = [...bySponsor.entries()].map(([id, list]): StreamGroup => {
      const sponsor = list[0].sponsor;
      return {
        key: id,
        title: sponsor?.name ?? "No sponsor chosen",
        subtitle: `${list.length} ${list.length === 1 ? "item" : "items"}`,
        href: sponsor ? `/companies/${sponsor.id}` : null,
        line: null,
        items: list,
        defaults: { stream: "sponsorship", sponsorId: sponsor?.id, sponsorName: sponsor?.name },
        warning: null,
      };
    });
    return { groups: groups.sort((a, b) => a.title.localeCompare(b.title)), options };
  }

  // Catapult: by the budget line that pays for it.
  const byLine = new Map<string, MarketingItem[]>();
  for (const i of items) byLine.set(i.budgetLine?.id ?? "none", [...(byLine.get(i.budgetLine?.id ?? "none") ?? []), i]);
  const lines = await lineSummaries([...byLine.keys()].filter((k) => k !== "none"));
  const groups = [...byLine.entries()].map(([id, list]): StreamGroup => {
    const line = lines.get(id) ?? null;
    return {
      key: id,
      title: line ? line.name : "No budget line",
      subtitle: line ? line.budgetName : null,
      href: line ? `/budgets/lines/${line.id}` : null,
      line,
      items: list,
      defaults: { stream: "catapult", budgetLineId: line?.id },
      warning: line ? null : "Choose a budget line for each of these so they show against a budget.",
    };
  });
  return { groups: groups.sort((a, b) => (a.key === "none" ? -1 : b.key === "none" ? 1 : a.title.localeCompare(b.title))), options };
}
