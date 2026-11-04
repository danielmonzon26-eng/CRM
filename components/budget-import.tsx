"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { importBudgetWorkbook, previewBudgetWorkbook } from "@/app/actions/budgets";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/budgets/money";
import type { ParseResult } from "@/lib/budgets/parse-workbook";

export function BudgetImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function choose(next: File | null) {
    setFile(next);
    setPreview(null);
    setError(null);
    if (!next) return;
    const form = new FormData();
    form.set("file", next);
    startTransition(async () => {
      try {
        setPreview(await previewBudgetWorkbook(form));
      } catch {
        setError("That file couldn't be read. It may be too large.");
      }
    });
  }

  function runImport() {
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      const result = await importBudgetWorkbook(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      router.push(`/budgets?budget=${result.id}`);
      router.refresh();
    });
  }

  const budget = preview?.budget;
  const ready = budget && preview.errors.length === 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="font-semibold text-slate-900">Import a budget from Excel</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Use the Catapult budget layout: a summary tab plus one tab per event. Nothing is saved until you confirm.
      </p>
      <input
        ref={inputRef}
        type="file"
        aria-label="Budget workbook"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={isPending}
        onChange={(e) => choose(e.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
      />
      {isPending && !preview && <p className="mt-3 text-sm text-slate-500">Reading the workbook...</p>}

      {preview && preview.errors.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" strokeWidth={2} />
            Fix these in the workbook before importing
          </p>
          <ul className="mt-1 list-disc pl-6">{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {budget && (
        <div className="mt-4">
          {ready && (
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              All totals in the workbook add up
            </p>
          )}
          <p className="font-medium text-slate-900">{budget.name}</p>
          <p className="text-sm text-slate-500">
            {budget.periodLabel} · {budget.lines.length} lines · {formatMoney(budget.total)}
          </p>
          <div className="relative mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Line</th>
                  <th scope="col" className="px-3 py-2 font-medium">Section</th>
                  <th scope="col" className="px-3 py-2 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                {budget.lines.map((line) => (
                  <tr key={line.name}>
                    <td className="px-3 py-2 font-medium text-slate-800">{line.name}</td>
                    <td className="px-3 py-2 text-slate-600">{line.section}</td>
                    <td className="px-3 py-2 text-slate-600">{line.kind === "event" ? `Event, ${line.items.length} items` : "General"}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {ready && (
        <button type="button" disabled={isPending} onClick={runImport} className={`${buttonClass("primary")} mt-4`}>
          <Upload className="h-4 w-4" strokeWidth={2} />
          {isPending ? "Importing..." : "Import this budget"}
        </button>
      )}
    </section>
  );
}
