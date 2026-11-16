import { OperationsCalendarLoader } from "@/components/operations-calendar-loader";
import { Page, PageHeader } from "@/components/ui/page";
import { getCalendarData } from "@/lib/calendar/queries";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [{ events, tasks, marketing, keyDates }, members] = await Promise.all([getCalendarData(), getTeamMembers()]);

  return (
    <Page>
      <PageHeader title="Calendar" subtitle="Every deadline across Catapult: events, marketing, tasks and key dates." />
      <OperationsCalendarLoader
        events={events}
        tasks={tasks}
        marketing={marketing}
        keyDates={keyDates}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
      />
    </Page>
  );
}
