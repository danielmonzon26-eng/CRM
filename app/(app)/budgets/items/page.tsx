import { redirect } from "next/navigation";
import { BudgetItemsView } from "@/components/budget-items-view";
import { BudgetPicker, NewBudget } from "@/components/budget-switcher";
import { BudgetTabs } from "@/components/budget-tabs";
import { Page, PageHeader } from "@/components/ui/page";
import { getBudgetList, getBudgetOverview, getEventOptions } from "@/lib/budgets/queries";

export const dynamic = "force-dynamic";

export default async function BudgetItemsPage() {
  const [budgets, budget, events] = await Promise.all([getBudgetList(), getBudgetOverview(), getEventOptions()]);
  if (!budget) redirect("/budgets");

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
      <BudgetItemsView key={budget.id} budget={budget} events={events} />
    </Page>
  );
}
