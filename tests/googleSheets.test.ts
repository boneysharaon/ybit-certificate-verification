import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCertificateByLetterId,
  SheetsConfigurationError,
} from "@/lib/googleSheets";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function configureEnvironment() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const exportedPrivateKey = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "spreadsheet-id");
  vi.stubEnv("GOOGLE_SHEETS_TAB_NAME", "Certificates");
  vi.stubEnv(
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "certificate-verifier@example.iam.gserviceaccount.com",
  );
  vi.stubEnv(
    "GOOGLE_PRIVATE_KEY",
    exportedPrivateKey.toString().replace(/\n/g, "\\n"),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getCertificateByLetterId", () => {
  it("returns a valid matching Sheet record", async () => {
    configureEnvironment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          values: [
            ["Letter ID", "Student Name", "Class", "Status"],
            [
              "ybit/culturaldept/yf/v/001",
              "Saee Manish Dhande",
              "T.E. Computer Science Engineering",
              "Valid",
            ],
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: true,
      status: "valid",
      certificate: {
        letterId: "YBIT/CulturalDept/YF/V/001",
        studentName: "Saee Manish Dhande",
        className: "T.E. Computer Science Engineering",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      cache: "no-store",
      headers: {
        Authorization: "Bearer access-token",
      },
    });
  });

  it("combines Class and Branch columns when the Sheet keeps them separate", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(
          jsonResponse({
            values: [
              ["Letter ID", "Student Name", "Class", "Branch", "Status"],
              [
                "YBIT/CulturalDept/YF/V/001",
                "Saee Manish Dhande",
                "T.E.",
                "Computer Science Engineering",
                "Valid",
              ],
            ],
          }),
        ),
    );

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: true,
      status: "valid",
      certificate: {
        letterId: "YBIT/CulturalDept/YF/V/001",
        studentName: "Saee Manish Dhande",
        className: "T.E. Computer Science Engineering",
      },
    });
  });

  it("includes optional Merit rank and category columns", async () => {
    configureEnvironment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          values: [
            [
              "Letter ID",
              "Student Name",
              "Class",
              "Branch",
              "Rank",
              "Event/Category",
              "Status",
            ],
            [
              "YBIT/CulturalDept/YF/V/001",
              "Saee Manish Dhande",
              "T.E.",
              "Computer Science Engineering",
              "First",
              "Solo Singing",
              "Valid",
            ],
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: true,
      status: "valid",
      certificate: {
        letterId: "YBIT/CulturalDept/YF/V/001",
        studentName: "Saee Manish Dhande",
        className: "T.E. Computer Science Engineering",
        meritRank: "First",
        meritCategory: "Solo Singing",
      },
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("A%3AZ");
  });

  it("includes Recognition recipient and service columns", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(
          jsonResponse({
            values: [
              [
                "Letter ID",
                "Recipient Type",
                "Recipient Name",
                "Class",
                "Branch",
                "Role",
                "Role Other",
                "Body Type",
                "Body Other",
                "Body Name",
                "Academic Year",
                "Term",
                "Status",
              ],
              [
                "YBIT/CulturalDept/YF/V/001",
                "Faculty",
                "Prof. Asha Patil",
                "",
                "",
                "Any other (Specify)",
                "Convenor",
                "Other",
                "Council",
                "Student Development",
                "2025-26",
                "Two-year term",
                "Valid",
              ],
            ],
          }),
        ),
    );

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: true,
      status: "valid",
      certificate: {
        letterId: "YBIT/CulturalDept/YF/V/001",
        studentName: "Prof. Asha Patil",
        className: "",
        recipientType: "Faculty",
        recognitionRole: "Convenor",
        recognitionBodyType: "Council",
        recognitionBodyName: "Student Development",
        recognitionAcademicYear: "2025-26",
        recognitionTerm: "Two-year term",
      },
    });
  });

  it("returns not found for a valid but nonexistent ID", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(
          jsonResponse({
            values: [
              ["Letter ID", "Student Name", "Class"],
              [
                "YBIT/CulturalDept/YF/V/002",
                "Harshali Alave",
                "T.E. Computer Engineering",
              ],
            ],
          }),
        ),
    );

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: false,
      status: "not_found",
    });
  });

  it("returns revoked when the optional Status column marks a record revoked", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(
          jsonResponse({
            values: [
              ["Letter ID", "Student Name", "Class", "Status"],
              [
                "YBIT/CulturalDept/YF/V/001",
                "Saee Manish Dhande",
                "T.E. Computer Science Engineering",
                "Revoked",
              ],
            ],
          }),
        ),
    );

    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).resolves.toEqual({
      found: true,
      status: "revoked",
    });
  });

  it("fails safely when server configuration is missing", async () => {
    await expect(
      getCertificateByLetterId("YBIT/CulturalDept/YF/V/001"),
    ).rejects.toBeInstanceOf(SheetsConfigurationError);
  });
});
