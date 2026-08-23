import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import downloads from "@/lib/youthFestivalDownloads.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DownloadRouteProps = {
  params: Promise<{
    downloadId: string;
  }>;
};

const cooldownCookieName = "ybit_yf_download_until";
const cooldownMs = 10 * 60 * 1000;
const certificateDir = path.join(
  process.cwd(),
  "private",
  "ecertificates",
  "youth-festival-2026",
);

function getCooldownUntil(request: NextRequest) {
  const value = Number(request.cookies.get(cooldownCookieName)?.value);
  return Number.isFinite(value) ? value : 0;
}

function makeCookie(request: NextRequest, until: number) {
  const isSecure = new URL(request.url).protocol === "https:";
  return [
    `${cooldownCookieName}=${until}`,
    "Max-Age=600",
    "Path=/api/download/youth-festival-2026",
    "HttpOnly",
    "SameSite=Lax",
    isSecure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function makeContentDisposition(fileName: string) {
  const asciiName = fileName.replace(/["\\]/g, "_").replace(/[^\x20-\x7e]/g, "");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function makeWaitMessage(waitMs: number) {
  const minutes = Math.ceil(waitMs / 60000);
  return `Please wait ${minutes} minute${minutes === 1 ? "" : "s"} before downloading another eCertificate.`;
}

export async function GET(request: NextRequest, { params }: DownloadRouteProps) {
  const { downloadId } = await params;
  const certificate = downloads.find((download) => download.downloadId === downloadId);

  if (!certificate) {
    return new Response("Certificate PDF not found.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const now = Date.now();
  const cooldownUntil = getCooldownUntil(request);

  if (cooldownUntil > now) {
    const waitMs = cooldownUntil - now;
    return new Response(makeWaitMessage(waitMs), {
      status: 429,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": String(Math.ceil(waitMs / 1000)),
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const pdf = await readFile(path.join(certificateDir, certificate.fileName));
  const response = new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      "Content-Disposition": makeContentDisposition(certificate.fileName),
      "Content-Type": "application/pdf",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

  response.headers.set("Set-Cookie", makeCookie(request, now + cooldownMs));
  return response;
}
