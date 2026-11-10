/**
 * Microsoft identity platform + Graph over plain fetch (matching lib/notifications/email.ts),
 * for the delegated "Connect Outlook" flow. Setup: docs/OUTLOOK_EMAIL.md.
 */

export const GRAPH = "https://graph.microsoft.com/v1.0";
/** Cookie holding "<state>.<user id>" between /api/outlook/connect and the callback. */
export const STATE_COOKIE = "outlook_oauth_state";
export const SCOPES =["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send", "Calendars.Read"];

// Immutable IDs keep a message's ID the same when it moves folders, so a message sent
// from the CRM (draft -> Sent Items) matches the row recorded at send time.
const IMMUTABLE_IDS = 'IdType="ImmutableId"';

export class ReconnectRequired extends Error {}

export function isOutlookConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MAIL_TOKEN_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function authority(): string {
  return `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "organizations"}/oauth2/v2.0`;
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    prompt: "select_account",
  });
  return `${authority()}/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string };

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${authority()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: SCOPES.join(" "),
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    if (json.error === "invalid_grant" || json.error === "interaction_required") {
      throw new ReconnectRequired(json.error_description ?? json.error);
    }
    throw new Error(`Microsoft sign-in failed (${res.status}): ${json.error_description ?? json.error ?? "unknown error"}`);
  }
  return json;
}

export function exchangeCode(code: string, redirectUri: string) {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string) {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** One Graph call. `path` is relative to v1.0 or a full nextLink/deltaLink URL. */
export async function graph<T>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string[] } = {}
): Promise<T> {
  const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: [IMMUTABLE_IDS, ...(init.prefer ?? [])].join(", "),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) throw new ReconnectRequired("Microsoft rejected the access token");
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new GraphError(res.status, json.error?.code ?? "", json.error?.message ?? res.statusText);
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class GraphError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(`Graph ${status} ${code}: ${message}`);
  }
}

export type GraphAddress = { emailAddress?: { address?: string; name?: string } };

export type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  sentDateTime?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  webLink?: string;
  "@removed"?: unknown;
};

export type GraphEvent = {
  id: string;
  subject?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
  organizer?: GraphAddress;
  attendees?: GraphAddress[];
  webLink?: string;
};

export type GraphPage<T> = { value: T[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
