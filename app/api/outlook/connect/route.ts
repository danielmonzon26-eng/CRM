import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { authorizeUrl, isOutlookConfigured, STATE_COOKIE } from "@/lib/outlook/graph";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Starts "Connect Outlook": sends the signed-in user to Microsoft to approve access. */
export async function GET() {
  const siteUrl = await getSiteUrl();
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${siteUrl}/login`);
  if (!isOutlookConfigured()) return NextResponse.redirect(`${siteUrl}/communication?outlook=not_configured`);

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authorizeUrl(`${siteUrl}/api/outlook/callback`, state));
  response.cookies.set(STATE_COOKIE, `${state}.${user.id}`, {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/outlook",
    maxAge: 600,
  });
  return response;
}
