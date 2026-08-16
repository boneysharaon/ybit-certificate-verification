import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/verify/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function postRequest(body: unknown) {
  return new Request("http://localhost:3000/api/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/verify", () => {
  it("rejects invalid input before making an external request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(postRequest({ letterId: "bad-input" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      found: false,
      status: "invalid_input",
    });
    expect(body.message).toContain("YBIT/CulturalDept/YF/V/001");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe error when server configuration is missing", async () => {
    const response = await POST(
      postRequest({ letterId: "YBIT/CulturalDept/YF/V/001" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      found: false,
      status: "configuration_error",
      message:
        "The verification service is not configured yet. Please contact the Cultural Committee of YBIT.",
    });
    expect(JSON.stringify(body)).not.toMatch(/GOOGLE|PRIVATE|spreadsheet/i);
  });
});
