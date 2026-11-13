import { StreamView } from "@/components/marketing/stream-view";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey } from "@/lib/events/format";
import { getStream } from "@/lib/marketing/streams";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function SponsorshipMarketingPage() {
  const data = await settle(getStream("sponsorship"));
  if (!data.ok) return <LoadError what="Sponsorship marketing" />;
  return <StreamView stream="sponsorship" groups={data.value.groups} options={data.value.options} today={calgaryDateKey(new Date())} />;
}
