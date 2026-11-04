export default function Loading() {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-[1600px] animate-pulse space-y-5">
        <div className="h-9 w-64 rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-200/70" />)}
        </div>
        <div className="h-72 rounded-xl bg-slate-200/70" />
      </div>
    </main>
  );
}
