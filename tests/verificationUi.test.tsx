import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CertificateVerificationForm from "@/components/CertificateVerificationForm";
import VerificationCertificate from "@/components/VerificationCertificate";
import { getDefaultCertificateEvent } from "@/lib/certificateEvents";

const event = getDefaultCertificateEvent();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verification UI", () => {
  it("renders a valid matching record correctly", () => {
    render(
      <VerificationCertificate
        event={event}
        certificate={{
          letterId: "YBIT/CulturalDept/YF/V/001",
          studentName: "Saee Manish Dhande",
          className: "T.E. Computer Science Engineering",
        }}
      />,
    );

    expect(screen.getByText("THIS IS AN AUTHENTIC ECERTIFICATE")).toBeInTheDocument();
    expect(screen.getAllByText("Saee Manish Dhande").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("T.E. Computer Science Engineering").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Print Certificate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to PDF" })).toBeInTheDocument();
    expect(
      screen.getByText("Scan this QR code to verify this certificate."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the Certificate ID.")).toBeInTheDocument();
    expect(screen.getByText("Click on Verify.")).toBeInTheDocument();
  });

  it("renders Merit certificate rank and category placeholders", () => {
    render(
      <VerificationCertificate
        event={{
          ...event,
          certificateType: "Merit",
          meritAwardTerm: "Position",
          letterTitle: "CERTIFICATE OF MERIT",
          letterBody: [
            "This is to certify that {{studentName}} secured {{meritRank}} {{meritAwardTerm}} in {{meritCategory}}.",
          ],
        }}
        certificate={{
          letterId: "YBIT/CulturalDept/YF/V/001",
          studentName: "Saee Manish Dhande",
          className: "T.E. Computer Science Engineering",
          meritRank: "First",
          meritCategory: "Solo Singing",
        }}
      />,
    );

    expect(screen.getByText("CERTIFICATE OF MERIT")).toBeInTheDocument();
    expect(screen.getAllByText("First").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Solo Singing").length).toBeGreaterThan(0);
    expect(screen.getByText("First Position")).toBeInTheDocument();
  });

  it("renders Recognition certificates without an event date", () => {
    render(
      <VerificationCertificate
        event={{
          ...event,
          certificateType: "Recognition",
          eventName: "Nature Club Recognition",
          eventDate: "",
          letterTitle: "CERTIFICATE OF RECOGNITION",
          letterBody: [
            "This is to certify that {{recipientName}}, {{recipientContext}}, rendered dedicated service as {{recognitionRole}} of {{recognitionBodyName}} {{recognitionBodyType}} for the academic year {{recognitionAcademicYear}}{{recognitionTermText}}.",
          ],
        }}
        certificate={{
          letterId: "YBIT/Club/NC/R/001",
          studentName: "Prof. Asha Patil",
          className: "",
          recipientType: "Faculty",
          recognitionRole: "Convenor",
          recognitionBodyType: "Club",
          recognitionBodyName: "Nature",
          recognitionAcademicYear: "2025-26",
          recognitionTerm: "Term I",
        }}
      />,
    );

    expect(screen.getByText("CERTIFICATE OF RECOGNITION")).toBeInTheDocument();
    expect(screen.getByText("Recipient Name")).toBeInTheDocument();
    expect(screen.getAllByText("Prof. Asha Patil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Convenor").length).toBeGreaterThan(0);
    expect(screen.getByText("Nature Club")).toBeInTheDocument();
    expect(screen.getAllByText("2025-26").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Term I").length).toBeGreaterThan(0);
    expect(screen.queryByText("Event Date")).not.toBeInTheDocument();
  });

  it("uses the fresh event template returned by verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          found: true,
          status: "valid",
          certificate: {
            letterId: "YBIT/CulturalDept/YF/V/001",
            studentName: "Saee Manish Dhande",
            className: "T.E. Computer Science Engineering",
          },
          event: {
            ...event,
            letterTitle: "UPDATED SIGNATURE TEMPLATE",
            signatories: [
              event.signatories[0],
              {
                ...event.signatories[1],
                signatureSrc:
                  "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=",
              },
            ],
          },
        }),
      ),
    );

    render(<CertificateVerificationForm event={event} />);

    await userEvent.type(screen.getByLabelText("Certificate ID"), "001");
    await userEvent.click(screen.getByRole("button", { name: "Verify eCertificate" }));

    await waitFor(() => {
      expect(screen.getByText("UPDATED SIGNATURE TEMPLATE")).toBeInTheDocument();
    });
  });

  it("shows the not-found message for a valid but nonexistent ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            found: false,
            status: "not_found",
          },
          404,
        ),
      ),
    );

    const fetchMock = vi.mocked(fetch);
    render(<CertificateVerificationForm event={event} />);

    await userEvent.type(screen.getByLabelText("Certificate ID"), "999");
    await userEvent.click(screen.getByRole("button", { name: "Verify eCertificate" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "No authentic eCertificate was found against the entered ID.",
        ),
      ).toBeInTheDocument();
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      eventSlug: event.slug,
      idPart: "999",
    });
    expect(
      screen.getByText("Please check the final ID number and enter it exactly as printed."),
    ).toBeInTheDocument();
  });

  it("shows the revoked state without rendering the authentic document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          found: true,
          status: "revoked",
        }),
      ),
    );

    render(<CertificateVerificationForm event={event} />);

    await userEvent.type(screen.getByLabelText("Certificate ID"), "001");
    await userEvent.click(screen.getByRole("button", { name: "Verify eCertificate" }));

    await waitFor(() => {
      expect(screen.getByText("CERTIFICATE REVOKED")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("THIS IS AN AUTHENTIC E-CERTIFICATE"),
    ).not.toBeInTheDocument();
  });
});
