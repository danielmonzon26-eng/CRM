import { addEventDocument } from "@/app/actions/events";
import { createClient } from "@/lib/supabase/client";

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/** Uploads one file from the browser to private storage and links it to the event. */
export async function uploadEventDocument(eventId: string, file: File): Promise<string | null> {
  if (file.size > MAX_DOCUMENT_BYTES) return `${file.name} is over the 50 MB limit.`;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${eventId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage.from("event-documents").upload(path, file);
  if (error) return `${file.name}: ${error.message}`;

  const result = await addEventDocument(eventId, file.name, path);
  return result.error ?? null;
}
