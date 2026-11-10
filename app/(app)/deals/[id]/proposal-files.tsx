"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, UploadCloud } from "lucide-react";
import { deleteDealFile } from "@/app/actions/deals";
import { useFeedback } from "@/components/ui/feedback";
import type { DealFile } from "@/lib/deals/queries";
import { uploadProposalFile } from "@/lib/deals/upload";

const uploadedOn = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Edmonton" });

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Copies of the proposal: drop files to upload, open or delete them. */
export function ProposalFiles({ dealId, files, uploaderNames }: { dealId: string; files: DealFile[]; uploaderNames: Record<string, string> }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [isDeleting, startDelete] = useTransition();

  async function upload(list: FileList | File[]) {
    const chosen = [...list];
    if (chosen.length === 0) return;
    setUploading(chosen.map((f) => f.name));
    const errors: string[] = [];
    for (const file of chosen) {
      const error = await uploadProposalFile(dealId, file).catch(() => `${file.name} didn't upload.`);
      if (error) errors.push(error);
    }
    setUploading([]);
    if (errors.length) toast(errors.join(" "), "error");
    else toast(chosen.length === 1 ? `${chosen[0].name} uploaded.` : `${chosen.length} files uploaded.`);
    router.refresh();
  }

  async function remove(file: DealFile) {
    const ok = await confirm({ title: `Delete ${file.fileName}?`, body: "The file is removed for everyone. This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    startDelete(async () => {
      const result = await deleteDealFile(file.id).catch(() => ({ error: "The file wasn't deleted. Please try again." }));
      if (result.error) toast(result.error, "error");
      else {
        toast(`${file.fileName} deleted.`);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40"
        }`}
      >
        <UploadCloud aria-hidden="true" className="h-6 w-6 text-slate-500" strokeWidth={1.75} />
        <span className="text-sm font-medium text-slate-800">{uploading.length ? `Uploading ${uploading.join(", ")}...` : "Drop the proposal here, or choose a file"}</span>
        <span className="text-xs text-slate-500">PDF, Word, slides or anything else, up to 50 MB each</span>
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={uploading.length > 0}
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <FileText className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                {file.url ? (
                  <a href={file.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {file.fileName}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium text-slate-900">{file.fileName}</span>
                )}
                <span className="block text-xs text-slate-500">
                  {[formatSize(file.sizeBytes), uploadedOn.format(new Date(file.createdAt)), file.uploadedBy ? uploaderNames[file.uploadedBy] : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              {file.url && (
                <a href={file.url} download={file.fileName} aria-label={`Download ${file.fileName}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                  <Download className="h-4 w-4" strokeWidth={2} />
                </a>
              )}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void remove(file)}
                aria-label={`Delete ${file.fileName}`}
                className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
