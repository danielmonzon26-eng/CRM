import { industryLabelForCode } from "@/lib/industries/naics";

/** Reads spreadsheet CSV text, including quoted commas and line breaks, and Excel's byte-order mark. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export type IndustryAssignment = { companyId: string; name: string; code: string; industry: string };
export type IndustryImport = { assignments: IndustryAssignment[]; skipped: number; invalid: string[]; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rows with a blank NAICS code are skipped, so anything still needing review is left alone. */
export function readIndustryCsv(text: string): IndustryImport {
  const [header, ...rows] = parseCsv(text);
  const column = (name: string) => header?.findIndex((h) => h.trim().toLowerCase() === name) ?? -1;
  const [idColumn, nameColumn, codeColumn] = [column("company id"), column("name"), column("naics code")];
  if (idColumn < 0 || nameColumn < 0 || codeColumn < 0) {
    return { assignments: [], skipped: 0, invalid: [], error: "This file needs the columns Company ID, Name, and NAICS code." };
  }

  const assignments: IndustryAssignment[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const row of rows) {
    const companyId = row[idColumn]?.trim() ?? "";
    const name = row[nameColumn]?.trim() ?? "";
    const code = row[codeColumn]?.trim() ?? "";
    if (!code) {
      skipped++;
      continue;
    }
    const industry = industryLabelForCode(code);
    if (!UUID.test(companyId) || !industry || seen.has(companyId)) {
      invalid.push(name || companyId || "A row with no name");
      continue;
    }
    seen.add(companyId);
    assignments.push({ companyId, name, code, industry });
  }
  return { assignments, skipped, invalid };
}
