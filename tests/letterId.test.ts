import { describe, expect, it } from "vitest";
import {
  validateAndNormalizeCertificateIdPart,
  validateAndNormalizeLetterId,
} from "@/lib/letterId";

describe("validateAndNormalizeLetterId", () => {
  it("accepts a correctly formatted ID", () => {
    expect(validateAndNormalizeLetterId("YBIT/CulturalDept/YF/V/001")).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/001",
    });
  });

  it("removes leading and trailing spaces", () => {
    expect(validateAndNormalizeLetterId("  YBIT/CulturalDept/YF/V/002  ")).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/002",
    });
  });

  it("normalizes lowercase input", () => {
    expect(validateAndNormalizeLetterId("ybit/culturaldept/yf/v/1h502")).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/1H502",
    });
  });

  it("rejects missing prefixes", () => {
    expect(validateAndNormalizeLetterId("CulturalDept/YF/V/001").ok).toBe(false);
  });

  it("rejects IDs outside the accepted final ID length", () => {
    expect(validateAndNormalizeLetterId("YBIT/CulturalDept/YF/V/01").ok).toBe(false);
    expect(validateAndNormalizeLetterId("YBIT/CulturalDept/YF/V/1234567890123").ok).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(validateAndNormalizeLetterId("YBIT/CulturalDept/YF/V/0A-1").ok).toBe(false);
  });

  it("rejects excessively long input", () => {
    expect(
      validateAndNormalizeLetterId(`YBIT/CulturalDept/YF/V/001${"0".repeat(80)}`).ok,
    ).toBe(false);
  });
});

describe("validateAndNormalizeCertificateIdPart", () => {
  it("builds a full certificate ID from the final ID number", () => {
    expect(
      validateAndNormalizeCertificateIdPart("001", {
        prefix: "YBIT/CulturalDept/YF/V/",
        digits: 3,
        example: "001",
      }),
    ).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/001",
    });
  });

  it("pads shorter numeric IDs", () => {
    expect(
      validateAndNormalizeCertificateIdPart("1", {
        prefix: "YBIT/CulturalDept/YF/V/",
        digits: 3,
        example: "001",
      }),
    ).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/001",
    });
  });

  it("accepts randomized alphanumeric IDs", () => {
    expect(
      validateAndNormalizeCertificateIdPart("1h502", {
        prefix: "YBIT/CulturalDept/YF/V/",
        digits: 3,
        example: "001",
      }),
    ).toEqual({
      ok: true,
      value: "YBIT/CulturalDept/YF/V/1H502",
    });
  });
});
