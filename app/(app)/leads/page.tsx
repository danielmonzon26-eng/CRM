import { LeadsWorkspace } from "@/components/leads-workspace";
import { Page, PageHeader } from "@/components/ui/page";
import { getEvents } from "@/lib/events/queries";
import { parseLeadView } from "@/lib/leads/filters";
import { getTeamMembers } from "@/lib/leads/queries";
import { getLeadFacets, getLeadTablePage, getStageSummaries } from "@/lib/leads/search";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const state = parseLeadView(await searchParams);
  const [facets, members, events, table, stages] = await Promise.all([
    getLeadFacets(),
    getTeamMembers(),
    getEvents(),
    getLeadTablePage(state),
    getStageSummaries(state),
  ]);

  return (
    <Page>
      <PageHeader title="Leads" subtitle="Shows Engaged companies: event attendees, anyone you're in contact or meeting with, and proposals. Use Status to see the others. A lead moves to Proposal on its own when a proposal is created." />
      <LeadsWorkspace
        state={state}
        table={table}
        stages={stages}
        facets={facets}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        events={events.map((e) => ({ id: e.id, title: e.title }))}
      />
    </Page>
  );
}
