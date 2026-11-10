import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { encryptToken } from "@/lib/outlook/crypto";
import { exchangeCode, graph, isOutlookConfigured, STATE_COOKIE } from "@/lib/outlook/graph";
import { syncAccount } from "@/lib/outlook/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Microsoft redirects here after the user approves access to their mailbox. */
export async function GET(request: NextRequest) {
  const siteUrl = await getSiteUrl();
  const done = (result: string) => {
    const response = NextResponse.redirect(`${siteUrl}/communication?outlook=${result}`);
    response.cookies.set(STATE_COOKIE, "", { path: "/api/outlook", maxAge: 0 });
    return response;
  };

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${siteUrl}/login`);
  if (!isOutlookConfigured()) return done("not_configured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done(params.get("error") === "access_denied" ? "declined" : "failed");

  const [expectedState, stateUser] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const state = params.get("state") ?? "";
  const code = params.get("code");
  if (!code || !expectedState || stateUser !== user.id || !sameString(state, expectedState)) return done("failed");

  try {
    const token = await exchangeCode(code, `${siteUrl}/api/outlook/callback`);
    if (!token.refresh_token) return done("failed");
    const me = await graph<{ mail?: string | null; userPrincipalName?: string; displayName?: string }>(
      token.access_token,
      "/me?$select=mail,userPrincipalName,displayName"
    );
    const email = (me.mail || me.userPrincipalName || "").toLowerCase();
    if (!email) return done("failed");

    const admin = createAdminClient();
    const { data: other } = await admin
      .from("mail_accounts")
      .select("user_id")
      .eq("email", email)
      .neq("user_id", user.id)
      .maybeSingle();
    if (other) return done("in_use");

    const { data: account, error } = await admin
      .from("mail_accounts")
      .upsert(
        {
          user_id: user.id,
          email,
          display_name: me.displayName ?? null,
          refresh_token: encryptToken(token.refresh_token),
          status: "connected",
          last_error: null,
          sync_started_at: null,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();
    if (error || !account) throw new Error(error?.message ?? "Mailbox wasn't saved");

    // First sync runs after the redirect, so the user isn't left waiting on Microsoft.
    after(() => syncAccount(admin, account.id).then(() => undefined));
    return done("connected");
  } catch (e) {
    console.error("Outlook connect failed:", e);
    return done("failed");
  }
}
