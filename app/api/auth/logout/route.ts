import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getRequestBaseUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", getRequestBaseUrl(request)));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
