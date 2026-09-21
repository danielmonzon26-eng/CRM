import { headers } from "next/headers";

/**
 * Base URL used for auth redirect links (magic link emails). Prefer setting
 * NEXT_PUBLIC_SITE_URL explicitly in production — deriving it from the request's Host
 * header works for a single deployment but is fragile behind proxies/multiple domains.
 */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
