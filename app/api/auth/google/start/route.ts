import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE_NAME,
  createOAuthState,
  getOAuthConfig,
  getRequestBaseUrl,
  isSecureRequest,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getOAuthConfig();
  const baseUrl = getRequestBaseUrl(request);

  if (!config) {
    return NextResponse.redirect(new URL("/admin?error=auth_setup", baseUrl));
  }

  const state = createOAuthState();
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "online");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request),
  });

  return response;
}
