"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { EventBudgetStep } from "@/components/event-budget-step";

const ignoreTotal = () => undefined;

/**
 * The event page's budget editor: the same one as the wizard's Budget step, so costs can be
 * added, renamed, repriced or removed after the event is created. The figures above it
 * refresh after each change.
 */
export function EventBudgetEditor({ eventId }: { eventId: string }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return <EventBudgetStep eventId={eventId} onTotal={ignoreTotal} onSaved={refresh} />;
}
