import { CompaniesWorkspace, parseCompanyView } from "@/components/companies-workspace";
import { Page } from "@/components/ui/page";
import { getCompaniesList } from "@/lib/companies/queries";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, companies] = await Promise.all([searchParams, getCompaniesList()]);

  return (
    <Page>
      <CompaniesWorkspace companies={companies} initial={parseCompanyView(params)} />
    </Page>
  );
}
