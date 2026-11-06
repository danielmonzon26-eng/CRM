import { IndustryImportForm } from "@/components/industry-import";
import { Page, PageHeader } from "@/components/ui/page";

export default function ImportIndustriesPage() {
  return (
    <Page width="form">
      <PageHeader title="Import industries" subtitle="Upload the reviewed spreadsheet. You'll see what will change before anything is saved." />
      <IndustryImportForm />
    </Page>
  );
}
