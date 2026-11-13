import { MarketingItemsList } from "@/components/marketing/marketing-items-list";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey } from "@/lib/events/format";
import { getMarketingItems } from "@/lib/marketing/items-queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function MarketingItemsPage() {
  const items = await settle(getMarketingItems());
  if (!items.ok) return <LoadError what="Marketing items" />;
  return <MarketingItemsList items={items.value} today={calgaryDateKey(new Date())} />;
}
