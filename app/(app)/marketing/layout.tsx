import Link from "next/link";
import { Plus } from "lucide-react";
import { MarketingTabs } from "@/components/marketing/marketing-tabs";
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
        subtitle="Plan initiatives and social posts, and get them approved before they go out."
        actions={
          <Link href="/marketing/posts/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            New post
          </Link>
        }
      />
      <MarketingTabs waitingCount={waiting} />
      {children}
    </Page>
  );
}
