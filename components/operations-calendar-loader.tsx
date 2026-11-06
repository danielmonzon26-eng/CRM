"use client";

import dynamic from "next/dynamic";

/** The calendar measures the browser and reads the viewer's time zone, so it renders there only. */
export const OperationsCalendarLoader = dynamic(
  () => import("@/components/operations-calendar").then((m) => m.OperationsCalendar),
  {
    ssr: false,
    loading: () => <div aria-busy="true" aria-label="Loading calendar" className="h-[640px] animate-pulse rounded-xl bg-slate-200/70" />,
  }
);
