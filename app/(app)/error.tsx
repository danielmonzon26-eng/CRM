"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, Page } from "@/components/ui/page";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <EmptyState
        icon={AlertTriangle}
        title="This page couldn't load"
        description="Your data is safe. Try again, and if it keeps happening, send us this page's address."
        action={
          <button type="button" onClick={reset} className={buttonClass("secondary")}>
            Try again
          </button>
        }
      />
    </Page>
  );
}
