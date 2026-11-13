import Link from "next/link";
import { PenLine } from "lucide-react";
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
        subtitle="Plan initiatives and social posts, and get them approved before they go out."
        actions={
          <>
            <Link href="/marketing/posts/new" className={buttonClass("secondary")}>
              <PenLine className="h-4 w-4" strokeWidth={2} />
              Write a post
            </Link>
            <RequestPostButton />
          </>
        }
      />
      <MarketingTabs waitingCount={waiting} />
      {children}
    </Page>
  );
}
