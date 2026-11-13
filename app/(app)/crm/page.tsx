import { CrmDashboardView } from "@/components/crm-dashboard";
import { LoadError } from "@/components/ui/load-error";
import { Page, PageHeader } from "@/components/ui/page";
import { getCrmDashboard } from "@/lib/crm/dashboard";
import { calgaryDateKey } from "@/lib/events/format";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function CrmDashboardPage() {
  const data = await settle(getCrmDashboard());
  return (
    <Page>
      <PageHeader title="CRM" subtitle="Proposals, leads, contacts and companies at a glance." />
      {data.ok ? <CrmDashboardView d={data.value} today={calgaryDateKey(new Date())} /> : <LoadError what="the CRM dashboard" />}
    </Page>
  );
}
