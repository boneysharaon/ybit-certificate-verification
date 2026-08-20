import { NextResponse } from "next/server";
import {
  getCertificateByLetterId,
  getCertificateEventBySlug,
  getDefaultPublishedCertificateEvent,
  SheetsConfigurationError,
} from "@/lib/googleSheets";
import {
  validateAndNormalizeCertificateIdPart,
  validateAndNormalizeLetterId,
} from "@/lib/letterId";
import type { VerifyApiResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function jsonResponse(body: VerifyApiResponse, status: number) {
  return NextResponse.json(body, {
    status,
    headers: responseHeaders,
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        found: false,
        status: "invalid_input",
        message:
          "Please enter a valid Letter ID, for example YBIT/CulturalDept/YF/V/001.",
      },
      400,
    );
  }

  const body = typeof payload === "object" && payload !== null ? payload : {};
  const eventSlug =
    "eventSlug" in body && typeof (body as { eventSlug?: unknown }).eventSlug === "string"
      ? (body as { eventSlug: string }).eventSlug
      : undefined;
  const idPart =
    "idPart" in body ? (body as { idPart?: unknown }).idPart : undefined;
  const letterId =
    "letterId" in body ? (body as { letterId?: unknown }).letterId : undefined;
  const event = eventSlug
    ? await getCertificateEventBySlug(eventSlug)
    : await getDefaultPublishedCertificateEvent();

  if (!event) {
    return jsonResponse(
      {
        found: false,
        status: "invalid_input",
        message: "Please choose a valid eCertificate verification page.",
      },
      400,
    );
  }

  const validation =
    idPart !== undefined
      ? validateAndNormalizeCertificateIdPart(idPart, {
          prefix: event.certificateIdPrefix,
          digits: event.certificateIdDigits,
          example: event.certificateIdExample,
        })
      : validateAndNormalizeLetterId(letterId, {
          prefix: event.certificateIdPrefix,
          digits: event.certificateIdDigits,
          example: event.certificateIdExample,
        });

  if (!validation.ok) {
    return jsonResponse(
      {
        found: false,
        status: "invalid_input",
        message: validation.message,
      },
      400,
    );
  }

  try {
    const result = await getCertificateByLetterId(validation.value, {
      tabName: event.sheetTabName,
      certificateIdPrefix: event.certificateIdPrefix,
      certificateIdDigits: event.certificateIdDigits,
      certificateIdExample: event.certificateIdExample,
    });

    if (!result.found) {
      return jsonResponse(
        {
          found: false,
          status: "not_found",
        },
        404,
      );
    }

    if (result.status === "revoked") {
      return jsonResponse(
        {
          found: true,
          status: "revoked",
        },
        200,
      );
    }

    return jsonResponse(
      {
        found: true,
        status: "valid",
        certificate: result.certificate,
        event,
      },
      200,
    );
  } catch (error) {
    if (error instanceof SheetsConfigurationError) {
      return jsonResponse(
        {
          found: false,
          status: "configuration_error",
          message:
            "The verification service is not configured yet. Please contact the Cultural Committee of YBIT.",
        },
        503,
      );
    }

    return jsonResponse(
      {
        found: false,
        status: "server_error",
        message:
          "We could not complete verification right now. Please try again later.",
      },
      500,
    );
  }
}
