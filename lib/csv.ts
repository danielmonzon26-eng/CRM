const REVOKE_DELAY_MS = 60_000;

/** Quotes a CSV value and defuses spreadsheet formulas, since some values come from public forms. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = typeof value !== "number" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Safari can drop a download if its link isn't on the page or its address is revoked right away. */
export function saveBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  saveBlob(fileName, new Blob([body], { type: "text/csv" }));
}
