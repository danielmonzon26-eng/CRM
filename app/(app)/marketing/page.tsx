import { MarketingOverview } from "@/components/marketing/marketing-overview";
import { LoadError } from "@/components/ui/load-error";
import { getMarketingDashboard } from "@/lib/marketing/dashboard";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function MarketingOverviewPage() {
  const result = await settle(getMarketingDashboard());
  if (!result.ok) return <LoadError what="The marketing overview" />;
  return <MarketingOverview d={result.value} />;
}
