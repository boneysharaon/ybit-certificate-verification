import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "ybit_admin_session";
export const OAUTH_STATE_COOKIE_NAME = "ybit_oauth_state";

export type AdminSession = {
  email: string;
  name: string;
  picture: string;
  exp: number;
};

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  authSecret: string;
  adminEmails: string[];
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const authSecret = process.env.AUTH_SECRET?.trim();
  const adminEmails = getAdminEmails();

  if (!clientId || !clientSecret || !authSecret || adminEmails.length === 0) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    authSecret,
    adminEmails,
  };
}

export function isAdminEmail(email: string, config = getOAuthConfig()) {
  return (
    !!config &&
    config.adminEmails.includes(email.trim().toLowerCase())
  );
}

function signPayload(payload: string, secret: string) {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

export function createSessionCookieValue(session: AdminSession, secret: string) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function readSessionCookieValue(
  cookieValue: string | undefined,
  secret: string,
) {
  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload).toString("utf8")) as
      | AdminSession
      | null;

    if (
      !session ||
      typeof session.email !== "string" ||
      typeof session.exp !== "number" ||
      session.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const config = getOAuthConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  const session = readSessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    config.authSecret,
  );

  if (!session || !isAdminEmail(session.email, config)) {
    return null;
  }

  return session;
}

export function getAdminSessionFromRequest(request: Request) {
  const config = getOAuthConfig();

  if (!config) {
    return null;
  }

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
  const session = readSessionCookieValue(value, config.authSecret);

  if (!session || !isAdminEmail(session.email, config)) {
    return null;
  }

  return session;
}

export function createOAuthState() {
  return base64UrlEncode(randomBytes(32));
}

export function getRequestBaseUrl(request: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "");

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/g, "");
  }

  const url = new URL(request.url);
  return url.origin;
}

export function isSecureRequest(request: Request) {
  const baseUrl = getRequestBaseUrl(request);
  return baseUrl.startsWith("https://");
}
