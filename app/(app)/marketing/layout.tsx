import Link from "next/link";
import { ListPlus, PenLine } from "lucide-react";
import { MarketingTabs } from "@/components/marketing/marketing-tabs";
import { RequestPostButton } from "@/components/marketing/request-post";
import { buttonClass } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { getWaitingApprovalCount } from "@/lib/marketing/queries";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const waiting = await getWaitingApprovalCount().catch((e) => {
    console.error("Waiting approval count failed:", e);
    return 0;
  });
  return (
    <Page>
      <PageHeader
        title="Marketing"
        subtitle="Plan Catapult, event and sponsorship marketing, from creative and production to ads and social posts."
        actions={
          <>
            <Link href="/marketing/planner?view=table" className={buttonClass("secondary")}>
              <ListPlus className="h-4 w-4" strokeWidth={2} />
              Marketing items
            </Link>
            <RequestPostButton variant="secondary" />
            <Link href="/marketing/posts/new" className={buttonClass("primary")}>
              <PenLine className="h-4 w-4" strokeWidth={2} />
              Write a post
            </Link>
          </>
        }
      />
      <MarketingTabs waitingCount={waiting} />
      {children}
    </Page>
  );
}
