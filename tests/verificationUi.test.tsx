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
