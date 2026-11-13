import { redirect } from "next/navigation";
import { ChannelsManager } from "@/components/marketing/channels-manager";
import { LoadError } from "@/components/ui/load-error";
import { getCurrentUser } from "@/lib/auth/session";
import { getChannels } from "@/lib/marketing/queries";
import { settle } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const channels = await settle(getChannels(true));
  if (!channels.ok) return <LoadError what="Channels" />;
  return <ChannelsManager channels={channels.value} isAdmin={user.role === "admin"} />;
}
