import { EventReportTable } from "@/components/event-report-table";
import { Page, PageHeader } from "@/components/ui/page";
import { getEventReport } from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const rows = await getEventReport();

  return (
    <Page>
      <PageHeader title="Event reporting" subtitle="People, revenue, and costs for every event." />
      <EventReportTable rows={rows} />
    </Page>
  );
}
