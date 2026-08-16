export const LETTER_ID_EXAMPLE = "YBIT/CulturalDept/YF/V/001";
export const LETTER_ID_VALIDATION_MESSAGE =
  "Please enter a valid Letter ID, for example YBIT/CulturalDept/YF/V/001.";
export const DEFAULT_LETTER_ID_PREFIX = "YBIT/CulturalDept/YF/V/";

const MAX_LETTER_ID_LENGTH = 64;
const LETTER_ID_PATTERN = /^ybit\/culturaldept\/yf\/v\/(\d{3})$/i;

export type LetterIdValidationResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      message: string;
    };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCertificateId(prefix: string, idPart: string) {
  return `${prefix}${idPart}`;
}

export function validateAndNormalizeCertificateIdPart(
  input: unknown,
  options: {
    prefix: string;
    digits: number;
    example: string;
  },
): LetterIdValidationResult {
  const message = `Please enter a valid Certificate ID number, for example ${options.example}.`;

  if (
    typeof input !== "string" ||
    !Number.isInteger(options.digits) ||
    options.digits <= 0
  ) {
    return {
      ok: false,
      message,
    };
  }

  const trimmed = input.trim();
  const pattern = new RegExp(`^\\d{1,${options.digits}}$`);

  if (!pattern.test(trimmed)) {
    return {
      ok: false,
      message,
    };
  }

  return {
    ok: true,
    value: buildCertificateId(options.prefix, trimmed.padStart(options.digits, "0")),
  };
}

export function validateAndNormalizeLetterId(
  input: unknown,
  options?: {
    prefix?: string;
    digits?: number;
    example?: string;
  },
): LetterIdValidationResult {
  const prefix = options?.prefix ?? DEFAULT_LETTER_ID_PREFIX;
  const digits = options?.digits ?? 3;
  const example = options?.example ?? LETTER_ID_EXAMPLE;
  const message = `Please enter a valid Letter ID, for example ${prefix}${example}.`;

  if (typeof input !== "string") {
    return {
      ok: false,
      message:
        options?.prefix || options?.digits || options?.example
          ? message
          : LETTER_ID_VALIDATION_MESSAGE,
    };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_LETTER_ID_LENGTH) {
    return {
      ok: false,
      message:
        options?.prefix || options?.digits || options?.example
          ? message
          : LETTER_ID_VALIDATION_MESSAGE,
    };
  }

  const match =
    options?.prefix || options?.digits || options?.example
      ? trimmed.match(
          new RegExp(`^${escapeRegExp(prefix)}(\\d{${digits}})$`, "i"),
        )
      : trimmed.match(LETTER_ID_PATTERN);

  if (!match) {
    return {
      ok: false,
      message:
        options?.prefix || options?.digits || options?.example
          ? message
          : LETTER_ID_VALIDATION_MESSAGE,
    };
  }

  return {
    ok: true,
    value: buildCertificateId(prefix, match[1]),
  };
}
