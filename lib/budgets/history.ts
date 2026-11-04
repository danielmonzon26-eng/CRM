import { formatMoney } from "@/lib/budgets/money";
import type { BudgetChangeRow } from "@/lib/budgets/queries";

type Data = Record<string, unknown> | null;

const LINE_FIELDS: Record<string, string> = { name: "name", section: "section", owner_name: "owner", notes: "notes", plan_month: "plan month", event_id: "linked event" };

export function monthLabel(month: string): string {
  return new Date(`${String(month).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

const money = (value: unknown) => formatMoney(Number(value ?? 0));

function moneyChange(before: Data, after: Data, field = "amount"): string | null {
  const from = Number(before?.[field] ?? 0);
  const to = Number(after?.[field] ?? 0);
  return from === to ? null : `${formatMoney(from)} to ${formatMoney(to)}`;
}

/** A plain-language sentence for a recorded change, or null if it isn't worth showing. */
export function describeBudgetChange(change: BudgetChangeRow): string | null {
  const { before_data: before, after_data: after, action, lineName } = change;
  const line = lineName ?? "A line";

  switch (change.table_name) {
    case "budget_lines": {
      if (action === "insert") return `Added line "${after?.name}"`;
      if (action === "delete") return `Deleted line "${before?.name}"`;
      const changed = Object.keys(LINE_FIELDS).filter((key) => before?.[key] !== after?.[key]);
      return changed.length ? `${line}: changed ${changed.map((key) => LINE_FIELDS[key]).join(", ")}` : null;
    }
    case "budget_allocations": {
      const month = monthLabel(String(after?.month ?? before?.month));
      if (action === "insert" && !Number(after?.amount)) return null;
      const delta = moneyChange(before, after);
      return delta ? `${line}, ${month}: ${delta}` : null;
    }
    case "budget_items": {
      if (action === "insert") return `${line}: added item "${after?.name}" at ${money(after?.amount)}`;
      if (action === "delete") return `${line}: removed item "${before?.name}" (${money(before?.amount)})`;
      const delta = moneyChange(before, after);
      if (delta) return `${line}, ${after?.name}: ${delta}`;
      return before?.name !== after?.name ? `${line}: renamed item "${before?.name}" to "${after?.name}"` : null;
    }
    case "budget_expenses": {
      if (action === "insert") return `${line}: added ${after?.status} expense of ${money(after?.amount)}`;
      if (action === "delete") return `${line}: deleted ${before?.status} expense of ${money(before?.amount)}`;
      return `${line}: edited an expense${moneyChange(before, after) ? `, ${moneyChange(before, after)}` : ""}`;
    }
    default:
      return null;
  }
}
