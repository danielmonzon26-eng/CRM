"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { saveBlob } from "@/lib/csv";

/** Fetches the file first, so a failure shows a message rather than doing nothing. */
export function CompanyExport() {
  const { toast } = useFeedback();
  const [isExporting, setIsExporting] = useState(false);

  async function exportCompanies() {
    setIsExporting(true);
    try {
      const response = await fetch("/api/companies/export", { cache: "no-store" });
      // A signed-out request is sent to the login page, which isn't a CSV.
      if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) {
        toast("That export didn't finish. Please refresh, sign in if asked, and try again.", "error");
        return;
      }
      saveBlob("companies.csv", await response.blob());
      toast("Companies exported. Check your Downloads folder.");
    } catch {
      toast("That export didn't finish. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button type="button" disabled={isExporting} onClick={() => void exportCompanies()} className={buttonClass("secondary")}>
      <Download className="h-4 w-4" strokeWidth={2} />
      {isExporting ? "Exporting..." : "Export"}
    </button>
  );
}
