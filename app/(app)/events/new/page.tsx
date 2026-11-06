import { EventWizard } from "@/components/event-wizard";
import { Page, PageHeader } from "@/components/ui/page";
import { getEventTemplates } from "@/lib/events/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  const [members, templates] = await Promise.all([getTeamMembers(), getEventTemplates()]);

  return (
    <Page>
      <PageHeader title="Create an event" subtitle="Set up your event, from details to registration and budget." />
      <EventWizard members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))} templates={templates} initialStart={start && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ? start : ""} />
    </Page>
  );
}
