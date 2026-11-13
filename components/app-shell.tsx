import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getWaitingApprovalCount } from "@/lib/marketing/queries";
import { getUnseenReplyCount } from "@/lib/outlook/queries";
import { getOpenTaskCount } from "@/lib/tasks/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RouteProgress } from "@/components/route-progress";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { FeedbackProvider } from "@/components/ui/feedback";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  // Only the nav badges depend on these, so a failure hides that badge and is logged; the
  // pages themselves show their own errors.
  const isAdmin = user?.role === "admin";
  const [openTaskCount, unseenMailCount, waitingApprovalCount] = user
    ? await Promise.all([
        getOpenTaskCount().catch((e) => {
          console.error("Open task count failed:", e);
          return 0;
        }),
        getUnseenReplyCount().catch((e) => {
          console.error("New email count failed:", e);
          return 0;
        }),
        // Only admins approve, so only they see the count.
        isAdmin
          ? getWaitingApprovalCount().catch((e) => {
              console.error("Waiting approval count failed:", e);
              return 0;
            })
          : 0,
      ])
    : [0, 0, 0];
  const counts = { tasks: openTaskCount, mail: unseenMailCount, approvals: waitingApprovalCount };

  return (
    <FeedbackProvider>
      <RouteProgress />
      <div className="flex min-h-screen bg-canvas">
      <Sidebar
        isAdmin={isAdmin}
        counts={counts}
        initialCollapsed={cookieStore.get("sidebar-collapsed")?.value === "1"}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} counts={counts} isAdmin={isAdmin} />
        <Breadcrumbs />
        <div className="flex-1">{children}</div>
      </div>
      </div>
    </FeedbackProvider>
  );
}
