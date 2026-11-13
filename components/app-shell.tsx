import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
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
  const [openTaskCount, unseenMailCount] = user
    ? await Promise.all([
        getOpenTaskCount().catch((e) => {
          console.error("Open task count failed:", e);
          return 0;
        }),
        getUnseenReplyCount().catch((e) => {
          console.error("New email count failed:", e);
          return 0;
        }),
      ])
    : [0, 0];
  const isAdmin = user?.role === "admin";

  return (
    <FeedbackProvider>
      <RouteProgress />
      <div className="flex min-h-screen bg-canvas">
      <Sidebar
        isAdmin={isAdmin}
        openTaskCount={openTaskCount}
        unseenMailCount={unseenMailCount}
        initialCollapsed={cookieStore.get("sidebar-collapsed")?.value === "1"}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} openTaskCount={openTaskCount} unseenMailCount={unseenMailCount} isAdmin={isAdmin} />
        <Breadcrumbs />
        <div className="flex-1">{children}</div>
      </div>
      </div>
    </FeedbackProvider>
  );
}
