import { redirect } from "next/navigation";
import { ApprovalsBoard } from "@/components/marketing/approvals-board";
import { LoadError } from "@/components/ui/load-error";
import { getCurrentUser } from "@/lib/auth/session";
import { getPosts } from "@/lib/marketing/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function MarketingApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const posts = await settle(getPosts());
  if (!posts.ok) return <LoadError what="Posts" />;
  return <ApprovalsBoard posts={posts.value} isAdmin={user.role === "admin"} userId={user.id} />;
}
