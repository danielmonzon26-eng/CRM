import { ProposalsBoard, type ProposalBoardFilters } from "@/components/proposals-board";
import { StatsBar } from "@/components/stats-bar";
import { Page, PageHeader } from "@/components/ui/page";
import { getPipelineForecast, getProposalBoard } from "@/lib/deals/queries";
import { EVENT_TIME_ZONE } from "@/lib/events/format";
import { getTeamMembers } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [forecast, proposals, members] = await Promise.all([getPipelineForecast(), getProposalBoard(), getTeamMembers()]);
  const filters: ProposalBoardFilters = {
    q: params.q ?? "",
    staff: params.staff ?? "",
    clientType: params.clientType ?? "",
    work: params.work ?? "",
    payment: params.payment ?? "",
    committee: params.committee ?? "",
  };

  return (
    <Page>
      <PageHeader title="Proposals" subtitle="Every proposal from first draft to accepted or declined." />
      <StatsBar forecast={forecast} />
      <ProposalsBoard
        proposals={proposals}
        members={members.map((m) => ({ id: m.id, name: m.fullName ?? m.email ?? "Unknown" }))}
        initialFilters={filters}
        today={new Date().toLocaleDateString("en-CA", { timeZone: EVENT_TIME_ZONE })}
      />
    </Page>
  );
}
