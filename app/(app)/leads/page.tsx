import { LeadsWorkspace } from "@/components/leads-workspace";
import { Page, PageHeader } from "@/components/ui/page";
import { getEvents } from "@/lib/events/queries";
import { parseLeadView } from "@/lib/leads/filters";
import { getTeamMembers } from "@/lib/leads/queries";
import { getLeadBoard, getLeadFacets, getLeadTablePage, getStageSummaries } from "@/lib/leads/search";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const state = parseLeadView(await searchParams, "table");
  const [facets, members, events, board, table, stages] = await Promise.all([
    getLeadFacets(),
    getTeamMembers(),
    getEvents(),
    state.view === "board" ? getLeadBoard(state) : Promise.resolve(null),
    state.view === "table" ? getLeadTablePage(state) : Promise.resolve(null),
    getStageSummaries(state),
  ]);

  return (
    <Page>
      <PageHeader title="Leads" subtitle="Search, filter, and work every lead." />
      <LeadsWorkspace
        state={state}
        defaultView="table"
        basePath="/leads"
        board={board}
        table={table}
        stages={stages}
        facets={facets}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        events={events.map((e) => ({ id: e.id, title: e.title }))}
      />
    </Page>
  );
}
