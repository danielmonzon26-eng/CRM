import { Wallet } from "lucide-react";
import { BudgetOverviewView } from "@/components/budget-overview";
import { BudgetPicker, NewBudget } from "@/components/budget-switcher";
import { BudgetTabs } from "@/components/budget-tabs";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";
import { getBudgetChanges, getBudgetList, getBudgetOverview, getEventOptions } from "@/lib/budgets/queries";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const [budgets, overview, events] = await Promise.all([getBudgetList(), getBudgetOverview(), getEventOptions()]);
  const changes = overview ? await getBudgetChanges({ budgetId: overview.id }) : [];

  return (
    <Page>
      <PageHeader
        title={overview?.name ?? "Budgets"}
        subtitle={overview ? `${overview.periodLabel ?? ""}${overview.sourceFile ? ` · Imported from ${overview.sourceFile}` : ""}` : "Track planned versus actual spending."}
        actions={
          <>
            {overview && <BudgetPicker budgets={budgets} selectedId={overview.id} />}
            {overview && <NewBudget />}
          </>
        }
      />
      {overview ? (
        <>
          <BudgetTabs />
          <BudgetOverviewView key={overview.id} budget={overview} changes={changes} events={events} />
        </>
      ) : (
        <EmptyState icon={Wallet} title="No budgets yet" description="Create a budget, choose its quarters, and add its lines." action={<NewBudget />} />
      )}
    </Page>
  );
}
