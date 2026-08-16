import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSessionCookieValue,
  getOAuthConfig,
  getRequestBaseUrl,
  isAdminEmail,
  isSecureRequest,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: unknown;
};

type UserInfoResponse = {
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
};

function redirectToAdmin(request: Request, error?: string) {
  const baseUrl = getRequestBaseUrl(request);
  const url = new URL("/admin", baseUrl);

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url);
}

async function exchangeCodeForAccessToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as TokenResponse;
  return typeof data.access_token === "string" ? data.access_token : null;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as UserInfoResponse;
}

export async function GET(request: Request) {
  const config = getOAuthConfig();

  if (!config) {
    return redirectToAdmin(request, "auth_setup");
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToAdmin(request, "auth_failed");
  }

  const baseUrl = getRequestBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const accessToken = await exchangeCodeForAccessToken(
    code,
    redirectUri,
    config.clientId,
    config.clientSecret,
  );

  if (!accessToken) {
    return redirectToAdmin(request, "auth_failed");
  }

  const userInfo = await getGoogleUserInfo(accessToken);
  const email =
    typeof userInfo?.email === "string" ? userInfo.email.toLowerCase() : "";
  const emailVerified = userInfo?.email_verified === true;

  if (!email || !emailVerified || !isAdminEmail(email, config)) {
    return redirectToAdmin(request, "not_authorized");
  }

  const session = {
    email,
    name: typeof userInfo?.name === "string" ? userInfo.name : email,
    picture: typeof userInfo?.picture === "string" ? userInfo.picture : "",
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  };
  const response = redirectToAdmin(request);

  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionCookieValue(session, config.authSecret),
    {
      httpOnly: true,
      maxAge: 8 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(request),
    },
  );

  return response;
}
