import { redirect } from "next/navigation";
import { BudgetAnalysisView } from "@/components/budget-analysis-view";
import { BudgetPicker, NewBudget } from "@/components/budget-switcher";
import { BudgetTabs } from "@/components/budget-tabs";
import { Page, PageHeader } from "@/components/ui/page";
import { getBudgetAnalysis, getBudgetRevenue, getWonDeals } from "@/lib/budgets/analysis";
import { getBudgetList, getBudgetOverview, getEventOptions } from "@/lib/budgets/queries";

export const dynamic = "force-dynamic";

export default async function BudgetAnalysisPage() {
  const [budgets, budget, events] = await Promise.all([getBudgetList(), getBudgetOverview(), getEventOptions()]);
  if (!budget) redirect("/budgets");
  const [rows, revenue, wonDeals] = await Promise.all([getBudgetAnalysis(budget), getBudgetRevenue(budget.id), getWonDeals(budget)]);

  return (
    <Page>
      <PageHeader
        title={budget.name}
        subtitle={budget.periodLabel ?? undefined}
        actions={
          <>
            <BudgetPicker budgets={budgets} selectedId={budget.id} />
            <NewBudget />
          </>
        }
      />
      <BudgetTabs />
      <BudgetAnalysisView key={budget.id} budget={budget} rows={rows} events={events} revenue={revenue} wonDeals={wonDeals} />
    </Page>
  );
}
