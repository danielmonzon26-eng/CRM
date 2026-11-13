import { createClient } from "@/lib/supabase/client";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/marketing/constants";

/** Uploads a post image from the browser to private storage; the post records it on save. */
export async function uploadPostImage(file: File): Promise<{ path: string; name: string } | { error: string }> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: "Use a JPG, PNG, WebP or GIF image." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Images can be up to 10 MB." };
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
  const path = `posts/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage.from("marketing-images").upload(path, file, { contentType: file.type });
  if (error) return { error: `The image didn't upload. ${error.message}` };
  return { path, name: file.name };
}
