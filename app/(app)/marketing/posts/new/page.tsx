import { redirect } from "next/navigation";
import { PostComposer } from "@/components/marketing/post-composer";
import { LoadError } from "@/components/ui/load-error";
import { getCurrentUser } from "@/lib/auth/session";
import { getChannels, getInitiatives } from "@/lib/marketing/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ date?: string; initiative?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { date, initiative } = await searchParams;
  const [channels, initiatives] = await Promise.all([settle(getChannels()), settle(getInitiatives())]);
  if (!channels.ok || !initiatives.ok) return <LoadError what="The post form" />;
  return (
    <PostComposer
      post={null}
      channels={channels.value}
      initiatives={initiatives.value.map((i) => ({ id: i.id, name: i.name }))}
      isAdmin={user.role === "admin"}
      userId={user.id}
      defaults={{
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
        initiativeId: initiatives.value.some((i) => i.id === initiative) ? initiative! : "",
      }}
    />
  );
}
