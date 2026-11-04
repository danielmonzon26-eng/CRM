import ExcelJS from "exceljs";
import { addCents, toCents, fromCents } from "@/lib/budgets/money";

export type ParsedMonth = { month: string; amount: number };
export type ParsedItem = { name: string; amount: number; actual: number | null; notes: string | null };
export type ParsedLine = {
  kind: "general" | "event";
  section: string;
  name: string;
  amount: number;
  actual: number | null;
  ownerName: string | null;
  notes: string | null;
  months: ParsedMonth[];
  items: ParsedItem[];
};
export type ParsedBudget = {
  name: string;
  periodLabel: string | null;
  sourceFile: string;
  notes: string | null;
  months: string[];
  lines: ParsedLine[];
  total: number;
};
export type ParseResult = { budget?: ParsedBudget; errors: string[] };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A formula cell's saved result, or a plain cell's value. */
function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result ?? null;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("error" in value) return null;
    if (value instanceof Date) return value;
    return null;
  }
  return value;
}

function text(cell: ExcelJS.Cell): string | null {
  const value = cellValue(cell);
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

function amount(cell: ExcelJS.Cell): number | null {
  const value = cellValue(cell);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** "Jan 2027" as "2027-01-01", or null if it isn't a month label. */
function parseMonth(value: string | null): string | null {
  const match = value?.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (!match) return null;
  const index = MONTHS.indexOf(match[1].toLowerCase());
  return index < 0 ? null : `${match[2]}-${String(index + 1).padStart(2, "0")}-01`;
}

function findHeaderRow(sheet: ExcelJS.Worksheet, label: string): number | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
    if (text(sheet.getCell(r, 1))?.toLowerCase() === label) return r;
  }
  return null;
}

function labelValue(sheet: ExcelJS.Worksheet, label: string): string | null {
  for (let r = 1; r <= 12; r++) {
    if (text(sheet.getCell(r, 1))?.toLowerCase() === label) return text(sheet.getCell(r, 2));
  }
  return null;
}

function parseEventSheet(sheet: ExcelJS.Worksheet, errors: string[]) {
  const header = findHeaderRow(sheet, "item");
  const name = labelValue(sheet, "event:");
  const month = parseMonth(labelValue(sheet, "month:"));
  if (!header || !name) {
    errors.push(`The "${sheet.name}" tab doesn't have the expected Event and Item rows.`);
    return null;
  }

  const items: ParsedItem[] = [];
  let statedTotal: number | null = null;
  for (let r = header + 1; r <= sheet.rowCount; r++) {
    const label = text(sheet.getCell(r, 1));
    if (!label) continue;
    if (/^total/i.test(label)) {
      statedTotal = amount(sheet.getCell(r, 2));
      break;
    }
    items.push({
      name: label,
      amount: amount(sheet.getCell(r, 2)) ?? 0,
      actual: amount(sheet.getCell(r, 3)),
      notes: text(sheet.getCell(r, 5)),
    });
  }

  const itemTotal = fromCents(addCents(items.map((i) => i.amount)));
  if (statedTotal !== null && toCents(statedTotal) !== toCents(itemTotal)) {
    errors.push(`"${name}": items add up to ${itemTotal}, but its total says ${statedTotal}.`);
  }
  return { name, month, ownerName: labelValue(sheet, "owner:"), items, total: itemTotal };
}

/**
 * Reads a budget workbook laid out like the Catapult marketing budget: a summary tab with a
 * "Line" header, month columns, and subtotals, plus one "Event - ..." tab per event. Checks
 * the workbook's own totals, so a problem is reported before anything is saved.
 */
export async function parseBudgetWorkbook(data: ArrayBuffer, sourceFile: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return { errors: ["That file couldn't be read. Please upload an .xlsx Excel file."] };
  }

  const errors: string[] = [];
  const summary = workbook.worksheets.find((sheet) => findHeaderRow(sheet, "line") !== null);
  if (!summary) return { errors: ['No summary tab was found. One tab needs a table with a "Line" column.'] };
  const header = findHeaderRow(summary, "line")!;

  const columns = new Map<string, number>();
  const monthColumns: { column: number; month: string }[] = [];
  for (let c = 1; c <= summary.columnCount; c++) {
    const label = text(summary.getCell(header, c));
    if (!label) continue;
    const month = parseMonth(label);
    if (month) monthColumns.push({ column: c, month });
    else columns.set(label.toLowerCase(), c);
  }
  const totalColumn = columns.get("total budget");
  if (!totalColumn || monthColumns.length === 0) {
    return { errors: ['The summary tab needs a "Total Budget" column and month columns such as "Jan 2027".'] };
  }
  const actualColumn = columns.get("total actual");
  const notesColumn = columns.get("notes");

  const eventSheets = new Map<string, NonNullable<ReturnType<typeof parseEventSheet>>>();
  for (const sheet of workbook.worksheets) {
    if (sheet === summary) continue;
    const parsed = parseEventSheet(sheet, errors);
    if (parsed) eventSheets.set(parsed.name.toLowerCase(), parsed);
  }

  const lines: ParsedLine[] = [];
  let section = "General";
  let statedTotal: number | null = null;

  for (let r = header + 1; r <= summary.rowCount; r++) {
    const label = text(summary.getCell(r, 1));
    if (!label) continue;
    if (/^total\b/i.test(label)) {
      statedTotal = amount(summary.getCell(r, totalColumn));
      break;
    }
    if (/^subtotal/i.test(label)) continue;

    const lineAmount = amount(summary.getCell(r, totalColumn));
    if (lineAmount === null) {
      section = label.replace(/\s*\(.*\)\s*$/, "");
      continue;
    }

    const months = monthColumns.map(({ column, month }) => ({ month, amount: amount(summary.getCell(r, column)) ?? 0 }));
    const eventSheet = eventSheets.get(label.toLowerCase());
    eventSheets.delete(label.toLowerCase());

    if (toCents(lineAmount) !== addCents(months.map((m) => m.amount))) {
      errors.push(`"${label}": its months don't add up to its total of ${lineAmount}.`);
    }
    if (eventSheet && toCents(eventSheet.total) !== toCents(lineAmount)) {
      errors.push(`"${label}": the summary says ${lineAmount}, but its event tab says ${eventSheet.total}.`);
    }

    const summaryActual = actualColumn ? amount(summary.getCell(r, actualColumn)) : null;
    lines.push({
      kind: eventSheet ? "event" : "general",
      section,
      name: label,
      amount: lineAmount,
      // An event's actuals are saved per item, so the summary's copy isn't counted twice.
      actual: eventSheet ? null : summaryActual,
      ownerName: eventSheet?.ownerName ?? null,
      notes: notesColumn ? text(summary.getCell(r, notesColumn)) : null,
      months,
      items: eventSheet?.items ?? [],
    });
  }

  for (const orphan of eventSheets.values()) {
    errors.push(`The event tab "${orphan.name}" has no matching line on the summary tab.`);
  }
  if (lines.length === 0) errors.push("No budget lines were found.");

  const total = fromCents(addCents(lines.map((l) => l.amount)));
  if (statedTotal !== null && toCents(statedTotal) !== toCents(total)) {
    errors.push(`Lines add up to ${total}, but the workbook's total says ${statedTotal}.`);
  }

  const name = text(summary.getCell(1, 1)) ?? sourceFile.replace(/\.xlsx$/i, "");
  const period = text(summary.getCell(2, 1));

  return {
    errors,
    budget: {
      name,
      periodLabel: period?.split("·")[0].replace(/^budget period:\s*/i, "").trim() ?? null,
      sourceFile,
      notes: period,
      months: monthColumns.map((m) => m.month),
      lines,
      total,
    },
  };
}
