import { AddMarketingItemButton } from "@/components/marketing/add-item-dialog";
import { MarketingTabs } from "@/components/marketing/marketing-tabs";
import { RequestPostButton } from "@/components/marketing/request-post";
import { Page, PageHeader } from "@/components/ui/page";
import { getItemOptions } from "@/lib/marketing/items-queries";
import { getWaitingApprovalCount } from "@/lib/marketing/queries";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [waiting, options] = await Promise.all([
    getWaitingApprovalCount().catch((e) => {
      console.error("Waiting approval count failed:", e);
      return 0;
    }),
    // Only the Add button needs these; it's hidden if they can't load.
    getItemOptions().catch((e) => {
      console.error("Marketing item options failed:", e);
      return null;
    }),
  ]);
  return (
    <Page>
      <PageHeader
        title="Marketing"
        subtitle="Plan Catapult, event and sponsorship marketing, from creative and production to ads and social posts."
        actions={
          <>
            <RequestPostButton variant="secondary" />
            {options && <AddMarketingItemButton options={options} />}
          </>
        }
      />
      <MarketingTabs waitingCount={waiting} />
      {children}
    </Page>
  );
}
