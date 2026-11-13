import { AlertTriangle } from "lucide-react";

/** A panel's data didn't load. Looks nothing like "nothing here yet" on purpose. */
export function LoadError({ what, className = "" }: { what: string; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 ${className}`}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <span>
        {what} couldn&apos;t load. Refresh the page to try again. Nothing has been lost.
      </span>
    </p>
  );
}
