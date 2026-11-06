export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main aria-busy="true" aria-label="Loading" className="animate-fade-delayed px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">{children}</div>
    </main>
  );
}

export function HeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

function Figures({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:[grid-template-columns:repeat(var(--count),minmax(0,1fr))]" style={{ "--count": count } as React.CSSProperties}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Frame>
      <Skeleton className="h-24 rounded-xl" />
      <Figures count={7} />
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <TableSkeleton rows={5} />
        <TableSkeleton rows={5} />
      </div>
    </Frame>
  );
}

export function TablePageSkeleton({ figures = 0 }: { figures?: number }) {
  return (
    <Frame>
      <HeadingSkeleton />
      {figures > 0 && <Figures count={figures} />}
      <Skeleton className="h-10 w-full max-w-2xl" />
      <TableSkeleton />
    </Frame>
  );
}

export function CalendarSkeleton() {
  return (
    <Frame>
      <HeadingSkeleton />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[640px] rounded-xl" />
    </Frame>
  );
}

export function WorkspaceSkeleton() {
  return (
    <Frame>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-10 w-full" />
      <Figures count={4} />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <TableSkeleton rows={5} />
        <TableSkeleton rows={3} />
      </div>
    </Frame>
  );
}

export function BoardSkeleton() {
  return (
    <Frame>
      <HeadingSkeleton />
      <Figures count={6} />
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />)}
      </div>
    </Frame>
  );
}
