import { headers } from "next/headers";

/**
 * Base URL used for auth redirect links (password reset emails). Order of
 * preference:
 *  1. NEXT_PUBLIC_SITE_URL — explicit override, set on Production only today.
 *  2. VERCEL_URL — set automatically by Vercel on every deployment (preview
 *     and production alike) to that deployment's own hostname. Preferred over
 *     the request's Host header, which was observed resolving to "localhost"
 *     on at least one preview deployment (likely internal request proxying),
 *     sending users a dead reset link.
 *  3. The request's Host header, for non-Vercel/local contexts.
 */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
