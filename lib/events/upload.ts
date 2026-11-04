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

const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const BANNER_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads a banner to the public bucket and returns its URL. */
export async function uploadEventBanner(file: File): Promise<{ url?: string; error?: string }> {
  if (!BANNER_TYPES.includes(file.type)) return { error: "Use a JPG, PNG, or WebP image." };
  if (file.size > MAX_BANNER_BYTES) return { error: "That image is over the 5 MB limit." };

  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("event-banners").upload(path, file);
  if (error) return { error: error.message };
  return { url: supabase.storage.from("event-banners").getPublicUrl(path).data.publicUrl };
}
