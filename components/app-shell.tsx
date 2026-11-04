import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getOpenTaskCount } from "@/lib/tasks/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RouteProgress } from "@/components/route-progress";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { FeedbackProvider } from "@/components/ui/feedback";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const openTaskCount = user ? await getOpenTaskCount().catch(() => 0) : 0;
  const isAdmin = user?.role === "admin";

  return (
    <FeedbackProvider>
      <RouteProgress />
      <div className="flex min-h-screen bg-canvas">
      <Sidebar
        isAdmin={isAdmin}
        openTaskCount={openTaskCount}
        initialCollapsed={cookieStore.get("sidebar-collapsed")?.value === "1"}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} openTaskCount={openTaskCount} isAdmin={isAdmin} />
        <Breadcrumbs />
        <div className="flex-1">{children}</div>
      </div>
      </div>
    </FeedbackProvider>
  );
}
