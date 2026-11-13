import { EventReportTable } from "@/components/event-report-table";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { LoadError } from "@/components/ui/load-error";
import { Page, PageHeader } from "@/components/ui/page";
import { getReportsDashboard } from "@/lib/reports/dashboard";
import { getEventReport } from "@/lib/reports/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const rows = await getEventReport();
  const result = await settle(getReportsDashboard(rows));

  return (
    <Page>
      <PageHeader title="Reports" subtitle="Leads, proposals, events, budget and marketing at a glance." />
      {!result.ok ? (
        <div className="mb-6">
          <LoadError what="The report summary" />
        </div>
      ) : (
        <ReportsDashboard d={result.value} />
      )}

      <section aria-labelledby="event-detail-title" className="mt-8">
        <h2 id="event-detail-title" className="mb-1 text-lg font-semibold text-slate-900">
          Event reporting
        </h2>
        <p className="mb-3 text-sm text-slate-500">People, revenue, and costs for every event.</p>
        <EventReportTable rows={rows} />
      </section>
    </Page>
  );
}
