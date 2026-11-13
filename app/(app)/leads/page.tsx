import { LeadsWorkspace } from "@/components/leads-workspace";
import { Page, PageHeader } from "@/components/ui/page";
import { getEvents } from "@/lib/events/queries";
import { parseLeadView } from "@/lib/leads/filters";
import { getTeamMembers } from "@/lib/leads/queries";
import { getEngagementSummaries, getLeadFacets, getLeadTablePage, getStageSummaries, getViewCounts } from "@/lib/leads/search";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const state = parseLeadView(await searchParams);
  const [facets, members, events, table, stages, engagements, viewCounts] = await Promise.all([
    getLeadFacets(),
    getTeamMembers(),
    getEvents(),
    getLeadTablePage(state),
    getStageSummaries(state),
    getEngagementSummaries(state),
    getViewCounts(state),
  ]);

  return (
    <Page>
      <PageHeader title="Leads" subtitle="Opens on the leads that need you today. Engaged companies only by default; use Status to see the others." />
      <LeadsWorkspace
        state={state}
        table={table}
        stages={stages}
        engagements={engagements}
        viewCounts={viewCounts}
        facets={facets}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        events={events.map((e) => ({ id: e.id, title: e.title }))}
      />
    </Page>
  );
}
