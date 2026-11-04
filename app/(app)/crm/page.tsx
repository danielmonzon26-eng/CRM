import { LeadsWorkspace } from "@/components/leads-workspace";
import { StatsBar } from "@/components/stats-bar";
import { Page, PageHeader } from "@/components/ui/page";
import { getPipelineForecast } from "@/lib/deals/queries";
import { getEvents } from "@/lib/events/queries";
import { parseLeadView } from "@/lib/leads/filters";
import { getPipelineStats, getTeamMembers } from "@/lib/leads/queries";
import { getLeadBoard, getLeadFacets, getLeadTablePage, getStageSummaries } from "@/lib/leads/search";

export const dynamic = "force-dynamic";

export default async function CrmDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const state = parseLeadView(await searchParams, "board");
  const [stats, forecast, facets, members, events, board, table, stages] = await Promise.all([
    getPipelineStats(),
    getPipelineForecast(),
    getLeadFacets(),
    getTeamMembers(),
    getEvents(),
    state.view === "board" ? getLeadBoard(state) : Promise.resolve(null),
    state.view === "table" ? getLeadTablePage(state) : Promise.resolve(null),
    getStageSummaries(state),
  ]);

  return (
    <Page>
      <PageHeader title="CRM Dashboard" subtitle="Your pipeline, from first contact to closed." />
      <StatsBar stats={stats} forecast={forecast} />
      <LeadsWorkspace
        state={state}
        defaultView="board"
        basePath="/crm"
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
