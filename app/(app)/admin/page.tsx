import Link from "next/link";
import { AdminUsers } from "@/components/admin-users";
import { Page, PageHeader } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageAccounts, getAdminUsers } from "@/lib/team/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return (
      <Page width="form">
        <PageHeader title="Admin" />
        <p className="text-sm text-slate-600">Only admins can open this page. Ask an admin to give you access.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Back to overview</Link>
      </Page>
    );
  }

  const users = await getAdminUsers();

  return (
    <Page width="form">
      <PageHeader title="Admin" subtitle="Add and remove the people who can use Catapult. Everyone has the same full admin access." />
      <AdminUsers users={users} currentUserId={currentUser.id} canManage={canManageAccounts()} />
    </Page>
  );
}
