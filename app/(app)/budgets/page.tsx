import { BudgetImport } from "@/components/budget-import";
import { BudgetOverviewView } from "@/components/budget-overview";
import { Page, PageHeader } from "@/components/ui/page";
import { getBudgetList, getBudgetOverview } from "@/lib/budgets/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
  const { budget: budgetId } = await searchParams;
  const [budgets, overview] = await Promise.all([getBudgetList(), getBudgetOverview(budgetId)]);

  return (
    <Page>
      <PageHeader
        title={overview?.name ?? "Budgets"}
        subtitle={overview ? `${overview.periodLabel ?? ""}${overview.sourceFile ? ` · Imported from ${overview.sourceFile}` : ""}` : "Track planned versus actual spending."}
      />
      {budgets.length > 1 && (
        <nav aria-label="Budgets" className="mb-4 flex flex-wrap gap-2 text-sm">
          {budgets.map((b) => (
            <Link
              key={b.id}
              href={`/budgets?budget=${b.id}`}
              aria-current={b.id === overview?.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${b.id === overview?.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"}`}
            >
              {b.name} · {b.periodLabel}
            </Link>
          ))}
        </nav>
      )}
      {overview ? (
        <div className="space-y-5">
          <BudgetOverviewView budget={overview} />
          <BudgetImport />
        </div>
      ) : (
        <BudgetImport />
      )}
    </Page>
  );
}
