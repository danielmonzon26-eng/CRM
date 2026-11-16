import Link from "next/link";
import { AdminUsers } from "@/components/admin-users";
import { Page, PageHeader } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageAccounts, getAdminUsers } from "@/lib/team/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser?.canManageUsers) {
    return (
      <Page width="form">
        <PageHeader title="Admin" />
        <p className="text-sm text-slate-600">Only account managers can open this page.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Back to overview</Link>
      </Page>
    );
  }

  const users = await getAdminUsers();

  return (
    <Page width="form">
      <PageHeader title="Admin" subtitle="Create the people who can use Catapult, set their passwords, and remove access. Only account managers see this page." />
      <AdminUsers users={users} currentUserId={currentUser.id} canManage={canManageAccounts()} />
    </Page>
  );
}
