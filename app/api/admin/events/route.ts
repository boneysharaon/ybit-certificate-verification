import { NextResponse } from "next/server";
import {
  deleteCertificateEvent,
  ensureEventsSheet,
  getCertificateEvents,
  upsertCertificateEvent,
  SheetsConfigurationError,
  SheetsRequestError,
} from "@/lib/googleSheets";
import { getAdminSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers,
  });
}

function ensureAdmin(request: Request) {
  return getAdminSessionFromRequest(request);
}

export async function GET(request: Request) {
  if (!ensureAdmin(request)) {
    return jsonResponse({ message: "Not authorized." }, 401);
  }

  try {
    await ensureEventsSheet();
    const events = await getCertificateEvents({
      includeDraft: true,
      fallbackToStatic: false,
    });
    return jsonResponse({ events }, 200);
  } catch (error) {
    if (error instanceof SheetsConfigurationError) {
      return jsonResponse({ message: "Google Sheets is not configured." }, 503);
    }

    return jsonResponse({ message: "Could not read Events from Google Sheets." }, 500);
  }
}

export async function POST(request: Request) {
  if (!ensureAdmin(request)) {
    return jsonResponse({ message: "Not authorized." }, 401);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: "Invalid event payload." }, 400);
  }

  try {
    const event = await upsertCertificateEvent(payload);
    return jsonResponse({ event }, 200);
  } catch (error) {
    if (error instanceof SheetsConfigurationError) {
      return jsonResponse({ message: "Google Sheets is not configured." }, 503);
    }

    if (error instanceof Error) {
      return jsonResponse({ message: error.message }, 400);
    }

    return jsonResponse({ message: "Could not save the event." }, 500);
  }
}

export async function DELETE(request: Request) {
  if (!ensureAdmin(request)) {
    return jsonResponse({ message: "Not authorized." }, 401);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: "Invalid delete payload." }, 400);
  }

  const body = typeof payload === "object" && payload !== null ? payload : {};
  const slug =
    "slug" in body && typeof (body as { slug?: unknown }).slug === "string"
      ? (body as { slug: string }).slug
      : "";

  if (!slug.trim()) {
    return jsonResponse({ message: "Event slug is required." }, 400);
  }

  try {
    const result = await deleteCertificateEvent(slug);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof SheetsConfigurationError) {
      return jsonResponse({ message: "Google Sheets is not configured." }, 503);
    }

    if (error instanceof SheetsRequestError) {
      return jsonResponse(
        { message: error.message },
        error.message.toLowerCase().includes("not found") ? 404 : 500,
      );
    }

    if (error instanceof Error) {
      return jsonResponse({ message: error.message }, 400);
    }

    return jsonResponse({ message: "Could not delete the event." }, 500);
  }
}
