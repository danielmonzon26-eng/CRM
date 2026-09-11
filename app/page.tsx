const STEPS = [
  { n: 1, label: "Project scaffold", done: true },
  { n: 2, label: "Database schema & migrations", done: false },
  { n: 3, label: "Calgary Open Data ingestion", done: false },
  { n: 4, label: "Lead qualification/scoring", done: false },
  { n: 5, label: "Contact enrichment (Hunter.io + web search)", done: false },
  { n: 6, label: "CRM frontend (pipeline board)", done: false },
  { n: 7, label: "Auth & team roles", done: false },
  { n: 8, label: "Additional source adapters", done: false },
  { n: 9, label: "Notifications & reporting", done: false },
  { n: 10, label: "Deployment walkthrough", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Calgary Lead Engine</h1>
        <p className="mt-1 text-slate-600">
          Build in progress — this page will become the CRM dashboard in Step 6.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                step.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {step.n}
            </span>
            <span className={step.done ? "text-slate-900" : "text-slate-500"}>{step.label}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
