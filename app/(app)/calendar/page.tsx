import { OperationsCalendarLoader } from "@/components/operations-calendar-loader";
import { Page, PageHeader } from "@/components/ui/page";
import { getCalendarData } from "@/lib/calendar/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [{ events, tasks }, members] = await Promise.all([getCalendarData(), getTeamMembers()]);

  return (
    <Page>
      <PageHeader title="Calendar" subtitle="Events and task deadlines across Catapult." />
      <OperationsCalendarLoader
        events={events}
        tasks={tasks}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
      />
    </Page>
  );
}
