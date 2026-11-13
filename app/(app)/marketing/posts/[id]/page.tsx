import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/marketing/post-composer";
import { getCurrentUser } from "@/lib/auth/session";
import { getChannels, getInitiatives, getPost } from "@/lib/marketing/queries";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [post, channels, initiatives] = await Promise.all([getPost(id), getChannels(true), getInitiatives()]);
  if (!post) notFound();
  // Inactive channels stay listed only where this post already uses them.
  const usable = channels.filter((c) => c.active || post.channels.some((pc) => pc.id === c.id));
  return (
    <PostComposer
      key={`${post.id}-${post.updatedLabel}-${post.status}`}
      post={post}
      channels={usable}
      initiatives={initiatives.map((i) => ({ id: i.id, name: i.name }))}
      isAdmin={user.role === "admin"}
      userId={user.id}
      defaults={{ date: "", initiativeId: "" }}
    />
  );
}
