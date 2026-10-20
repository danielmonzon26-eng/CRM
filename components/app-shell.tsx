import { getCurrentUser } from "@/lib/auth/session";
import { getOpenTaskCount } from "@/lib/tasks/queries";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;

  const openTaskCount = await getOpenTaskCount().catch(() => 0);
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar isAdmin={isAdmin} openTaskCount={openTaskCount} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} openTaskCount={openTaskCount} isAdmin={isAdmin} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
