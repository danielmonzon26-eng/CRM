import { OverviewDashboard } from "@/components/overview-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [data, user] = await Promise.all([getDashboardData(), getCurrentUser()]);
  return <OverviewDashboard data={data} firstName={user?.fullName?.trim().split(/\s+/)[0] ?? null} />;
}
