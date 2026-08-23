export const LETTER_ID_EXAMPLE = "YBIT/CulturalDept/YF/V/001";
export const LETTER_ID_VALIDATION_MESSAGE =
  "Please enter a valid Letter ID, for example YBIT/CulturalDept/YF/V/001.";
export const DEFAULT_LETTER_ID_PREFIX = "YBIT/CulturalDept/YF/V/";

const MAX_LETTER_ID_LENGTH = 64;
const MAX_CERTIFICATE_ID_PART_LENGTH = 12;
const LETTER_ID_PATTERN = /^ybit\/culturaldept\/yf\/v\/([a-z0-9]{3,12})$/i;

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

export function certificateIdPartMaxLength(digits: number, example: string) {
  const exampleLength = example.trim().length;

  return Math.max(
    MAX_CERTIFICATE_ID_PART_LENGTH,
    Number.isInteger(digits) && digits > 0 ? digits : 0,
    exampleLength,
  );
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

  const trimmed = input.trim().toUpperCase();
  const maxLength = certificateIdPartMaxLength(options.digits, options.example);
  const pattern = new RegExp(`^[A-Z0-9]{1,${maxLength}}$`);

  if (!pattern.test(trimmed)) {
    return {
      ok: false,
      message,
    };
  }

  return {
    ok: true,
    value: buildCertificateId(
      options.prefix,
      /^\d+$/.test(trimmed) && trimmed.length < options.digits
        ? trimmed.padStart(options.digits, "0")
        : trimmed,
    ),
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
          new RegExp(
            `^${escapeRegExp(prefix)}([a-z0-9]{1,${certificateIdPartMaxLength(
              digits,
              example,
            )}})$`,
            "i",
          ),
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
    value: buildCertificateId(prefix, match[1].toUpperCase()),
  };
}
