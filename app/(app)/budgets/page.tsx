import { Wallet } from "lucide-react";
import { EmptyState, Page, PageHeader } from "@/components/ui/page";

export default function BudgetsPage() {
  return (
    <Page>
      <PageHeader title="Budgets" subtitle="Track planned versus actual spending." />
      <EmptyState
        icon={Wallet}
        title="Budgets aren't set up yet"
        description="This is where budgets will live once your Excel sheet is imported."
      />
    </Page>
  );
}
