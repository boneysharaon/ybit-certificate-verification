import { describe, expect, it } from "vitest";
import {
  EVENTS_SHEET_HEADERS,
  eventToSheetRow,
  getDefaultCertificateEvent,
  sheetRowToEvent,
} from "@/lib/certificateEvents";

describe("certificate event parsing", () => {
  it("uses the corrected default principal signature instead of old embedded principal images", () => {
    const row = eventToSheetRow(getDefaultCertificateEvent());
    const signatoryTwoSignatureIndex = EVENTS_SHEET_HEADERS.indexOf(
      "Signatory 2 Signature Image",
    );
    row[signatoryTwoSignatureIndex] =
      "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=";

    const event = sheetRowToEvent([...EVENTS_SHEET_HEADERS], row);

    expect(event?.signatories[1].signatureSrc).toBe("/signatures/principal.png");
  });
});
