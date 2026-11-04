import Link from "next/link";
import { Plus } from "lucide-react";
import { EventsDirectory } from "@/components/events-directory";
import { buttonClass } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { getEvents } from "@/lib/events/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, members] = await Promise.all([getEvents(), getTeamMembers()]);

  return (
    <Page>
      <PageHeader
        title="Events"
        subtitle="Plan, manage and measure all Catapult events."
        actions={
          <Link href="/events/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New event
          </Link>
        }
      />
      <EventsDirectory
        events={events}
        ownerNames={Object.fromEntries(members.map((m) => [m.id, m.fullName ?? m.email ?? "Unknown"]))}
      />
    </Page>
  );
}
