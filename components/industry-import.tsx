"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload } from "lucide-react";
import { applyIndustryImport, previewIndustryImport, type IndustryPreview } from "@/app/actions/industries";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 shadow-card";
const INVALID_SHOWN = 10;

export function IndustryImportForm() {
  const router = useRouter();
  const { toast } = useFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<IndustryPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function check() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setError(null);
    setPreview(null);
    startTransition(async () => {
      try {
        const result = await previewIndustryImport(data);
        if (result.error) setError(result.error);
        else setPreview(result);
      } catch {
        setError("That file couldn't be read. Please try again.");
      }
    });
  }

  function apply() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setError(null);
    startTransition(async () => {
      try {
        const result = await applyIndustryImport(data);
        if (result.error) {
          setError(result.error);
          return;
        }
        toast(`${(result.updated ?? 0).toLocaleString()} companies updated`);
        router.push("/companies");
      } catch {
        setError("That import didn't finish. Importing the same file again finishes the rest.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} className={CARD} onSubmit={(e) => e.preventDefault()}>
        <label className="block text-sm font-medium text-slate-700">
          Reviewed CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={check}
            className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-50"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">It needs the columns Company ID, Name, and NAICS code. Rows with no code are left as they are.</p>
      </form>

      {isPending && <p role="status" className="text-sm text-slate-600">Working...</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {preview && !isPending && (
        <section className={`${CARD} animate-fade`} aria-label="Import preview">
          <h2 className="font-semibold text-slate-900">{preview.changes.toLocaleString()} companies will change</h2>
          <p className="mt-1 text-sm text-slate-600">
            {preview.unchanged.toLocaleString()} already match, and {preview.skipped.toLocaleString()} have no code and will be left alone.
          </p>
          {(preview.invalid.length > 0 || preview.unknown > 0) && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <div>
                {preview.invalid.length > 0 && <p>{preview.invalid.length.toLocaleString()} rows have an invalid code or ID and won&apos;t be saved: {preview.invalid.slice(0, INVALID_SHOWN).join(", ")}{preview.invalid.length > INVALID_SHOWN ? "..." : ""}</p>}
                {preview.unknown > 0 && <p>{preview.unknown.toLocaleString()} rows aren&apos;t in the CRM anymore and won&apos;t be saved.</p>}
              </div>
            </div>
          )}
          {preview.bySector.length > 0 && (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="py-2 font-medium">Sector</th>
                  <th scope="col" className="py-2 text-right font-medium">Companies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.bySector.map((row) => (
                  <tr key={row.sector}>
                    <th scope="row" className="py-1.5 font-normal text-slate-800">{row.sector}</th>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-5">
            <button type="button" disabled={preview.changes === 0} onClick={apply} className={buttonClass("primary")}>
              <Upload className="h-4 w-4" strokeWidth={2} />
              Update {preview.changes.toLocaleString()} companies
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
