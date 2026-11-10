import { addDealFile } from "@/app/actions/deals";
import { createClient } from "@/lib/supabase/client";

export const MAX_PROPOSAL_FILE_BYTES = 50 * 1024 * 1024;

/** Uploads a copy of the proposal from the browser to private storage and links it. */
export async function uploadProposalFile(dealId: string, file: File): Promise<string | null> {
  if (file.size > MAX_PROPOSAL_FILE_BYTES) return `${file.name} is over the 50 MB limit.`;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${dealId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage.from("proposal-files").upload(path, file, { contentType: file.type || undefined });
  if (error) return `${file.name} didn't upload. ${error.message}`;

  const result = await addDealFile(dealId, { name: file.name, path, size: file.size, type: file.type });
  return result.error ?? null;
}
