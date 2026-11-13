import { redirect } from "next/navigation";

export default async function OldInitiative({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/marketing/social/initiatives/${id}`);
}
