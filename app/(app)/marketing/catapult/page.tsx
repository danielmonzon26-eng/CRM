import { StreamView } from "@/components/marketing/stream-view";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey } from "@/lib/events/format";
import { getPosts } from "@/lib/marketing/queries";
import { getStream } from "@/lib/marketing/streams";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function CatapultMarketingPage() {
  const [data, posts] = await Promise.all([settle(getStream("catapult")), getPosts().catch(() => null)]);
  if (!data.ok) return <LoadError what="Catapult marketing" />;
  return <StreamView stream="catapult" groups={data.value.groups} options={data.value.options} today={calgaryDateKey(new Date())} posts={posts ?? undefined} />;
}
