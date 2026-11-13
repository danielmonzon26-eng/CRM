import { PromotionTimeline } from "@/components/marketing/promotion-timeline";
import { LoadError } from "@/components/ui/load-error";
import { getPromotionTimeline } from "@/lib/marketing/promotion-queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function PromotionPage() {
  const timeline = await settle(getPromotionTimeline());
  if (!timeline.ok) return <LoadError what="The promotion timeline" />;
  return <PromotionTimeline {...timeline.value} />;
}
