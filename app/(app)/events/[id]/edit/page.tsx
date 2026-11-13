import { notFound } from "next/navigation";
import { listEventPrograms } from "@/app/actions/programs";
import { EventWizard } from "@/components/event-wizard";
import { Page, PageHeader } from "@/components/ui/page";
import { getEventDetail } from "@/lib/events/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step } = await searchParams;
  const initialStep = Number(step);
  const [detail, members, programs] = await Promise.all([getEventDetail(id), getTeamMembers(), listEventPrograms().catch(() => undefined)]);
  if (!detail) notFound();

  return (
    <Page>
      <PageHeader title="Edit event" subtitle={detail.event.title} />
      <EventWizard
        event={detail.event}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        templates={[]}
        programs={programs}
        materials={detail.documents.map((d) => d.title)}
        videos={detail.videos.map((v) => v.url!)}
        initialStep={Number.isInteger(initialStep) && initialStep >= 0 && initialStep <= 4 ? initialStep : 0}
      />
    </Page>
  );
}
