import QRCode from "qrcode";
import { getCertificateEventBySlug } from "@/lib/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventQrRouteProps = {
  params: Promise<{
    eventSlug: string;
  }>;
};

export async function GET(request: Request, { params }: EventQrRouteProps) {
  const { eventSlug } = await params;
  const event = await getCertificateEventBySlug(eventSlug);

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const certificateUrl = `${url.origin}/certificates/${event.slug}`;
  const png = await QRCode.toBuffer(certificateUrl, {
    type: "png",
    margin: 1,
    scale: 8,
    errorCorrectionLevel: "M",
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "image/png",
    },
  });
}
