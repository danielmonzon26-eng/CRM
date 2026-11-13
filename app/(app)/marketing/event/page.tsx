import Link from "next/link";
import { Rocket } from "lucide-react";
import { StreamView } from "@/components/marketing/stream-view";
import { buttonClass } from "@/components/ui/button";
import { LoadError } from "@/components/ui/load-error";
import { calgaryDateKey } from "@/lib/events/format";
import { getStream } from "@/lib/marketing/streams";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function EventMarketingPage() {
  const data = await settle(getStream("event"));
  if (!data.ok) return <LoadError what="Event marketing" />;
  return (
    <StreamView
      stream="event"
      groups={data.value.groups}
      options={data.value.options}
      today={calgaryDateKey(new Date())}
      extra={
        <Link href="/marketing/promotion" className={buttonClass("secondary")}>
          <Rocket className="h-4 w-4" strokeWidth={2} />
          Paid promotion timeline
        </Link>
      }
    />
  );
}
