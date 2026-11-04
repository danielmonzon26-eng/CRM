import { notFound } from "next/navigation";
import { EventWizard } from "@/components/event-wizard";
import { Page, PageHeader } from "@/components/ui/page";
import { getEventDetail } from "@/lib/events/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, members] = await Promise.all([getEventDetail(id), getTeamMembers()]);
  if (!detail) notFound();

  return (
    <Page>
      <PageHeader title="Edit event" subtitle={detail.event.title} />
      <EventWizard
        event={detail.event}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        templates={[]}
        materials={detail.documents.map((d) => d.title)}
        videos={detail.videos.map((v) => v.url!)}
      />
    </Page>
  );
}
