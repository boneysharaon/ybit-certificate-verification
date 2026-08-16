export type CertificateEventStatus = "Published" | "Draft" | "Archived";

export type CertificateSignatory = {
  name: string;
  designation: string;
  signatureSrc: string;
  signatureAlt: string;
};

export type CertificateEvent = {
  slug: string;
  homeLinkLabel: string;
  pageTitle: string;
  pageDescription: string;
  sheetTabName: string;
  certificateIdPrefix: string;
  certificateIdDigits: number;
  certificateIdExample: string;
  verifyButtonLabel: string;
  eventName: string;
  eventDate: string;
  issueDate: string;
  letterTitle: string;
  letterBody: string[];
  qrInstructions: string[];
  signatories: [CertificateSignatory, CertificateSignatory];
  status: CertificateEventStatus;
};

export const EVENTS_SHEET_NAME = "Events";

export const EVENTS_SHEET_HEADERS = [
  "Event Name",
  "Slug",
  "Home Link Label",
  "Page Title",
  "Page Description",
  "Sheet Tab Name",
  "Certificate Prefix",
  "ID Digits",
  "Certificate ID Example",
  "Event Date",
  "Issue Date",
  "Letter Title",
  "Letter Body",
  "Signatory 1 Name",
  "Signatory 1 Designation",
  "Signatory 2 Name",
  "Signatory 2 Designation",
  "QR Instructions",
  "Status",
  "Verify Button Label",
  "Signatory 1 Signature Image",
  "Signatory 2 Signature Image",
] as const;

const MAX_SIGNATURE_DATA_URL_LENGTH = 48_000;
const SIGNATURE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;

const DEFAULT_LETTER_BODY = [
  "This is to place on record our sincere appreciation for {{studentName}}, a student of {{className}}, for volunteering during the {{eventName}} held at Yashwantrao Bhonsale Institute of Technology, Sawantwadi, on {{eventDate}}.",
  "The Cultural Committee gratefully acknowledges the student's dedication, responsible service and valuable contribution, which helped in the smooth conduct of the programme and in making the event a grand success.",
  "We sincerely thank the student for their help in making the event a grand success.",
];

const DEFAULT_QR_INSTRUCTIONS = [
  "Scan this QR code to verify this certificate.",
  "Enter the Certificate ID.",
  "Click on Verify.",
];

const DEFAULT_SIGNATORIES: [CertificateSignatory, CertificateSignatory] = [
  {
    name: "Mr. B. P. Sharaon",
    designation: "Cultural Co-ordinator, YBIT",
    signatureSrc: "/signatures/bpsharaon.png",
    signatureAlt: "Signature of Mr. B. P. Sharaon",
  },
  {
    name: "Dr. Raman Bane",
    designation: "Principal, YBIT",
    signatureSrc: "/signatures/principal.png",
    signatureAlt: "Signature of Dr. Raman Bane",
  },
];

export const fallbackCertificateEvents = [
  {
    slug: "youth-festival-2026-volunteer-ecertificates",
    homeLinkLabel: "Verify Youth Festival 2026 Volunteer eCertificates",
    pageTitle: "Youth Festival 2026 Volunteer eCertificate Verification",
    pageDescription:
      "Enter only the final numeric ID printed after YBIT/CulturalDept/YF/V/.",
    sheetTabName: "Certificates",
    certificateIdPrefix: "YBIT/CulturalDept/YF/V/",
    certificateIdDigits: 3,
    certificateIdExample: "001",
    verifyButtonLabel: "Verify eCertificate",
    eventName: "Youth Festival 2026",
    eventDate: "08/08/2026",
    issueDate: "08/08/2026",
    letterTitle: "LETTER OF APPRECIATION",
    letterBody: DEFAULT_LETTER_BODY,
    qrInstructions: DEFAULT_QR_INSTRUCTIONS,
    signatories: DEFAULT_SIGNATORIES,
    status: "Published",
  },
] as const satisfies readonly CertificateEvent[];

export const certificateEvents = fallbackCertificateEvents;

export type CertificateEventSlug =
  (typeof fallbackCertificateEvents)[number]["slug"];

function normaliseHeader(value: string) {
  return value.trim().toLowerCase();
}

function normaliseCell(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(normaliseCell(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: unknown): CertificateEventStatus {
  const normalised = normaliseCell(value).toLowerCase();

  if (normalised === "published") {
    return "Published";
  }

  if (normalised === "archived") {
    return "Archived";
  }

  return "Draft";
}

function splitParagraphs(value: unknown, fallback: string[]) {
  const text = normaliseCell(value);

  if (!text) {
    return fallback;
  }

  return text
    .split(/\n\s*\n|\r\n\s*\r\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitLines(value: unknown, fallback: string[]) {
  const text = normaliseCell(value);

  if (!text) {
    return fallback;
  }

  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function padCertificateExample(value: string, digits: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "1".padStart(digits, "0");
  }

  return /^\d+$/.test(trimmed) ? trimmed.padStart(digits, "0") : trimmed;
}

function getValue(
  headers: string[],
  row: string[],
  heading: (typeof EVENTS_SHEET_HEADERS)[number],
) {
  const index = headers.findIndex(
    (header) => normaliseHeader(header) === normaliseHeader(heading),
  );
  return index >= 0 ? row[index] : "";
}

function isAllowedSignatureSource(value: string) {
  return (
    value.startsWith("/") ||
    (value.length <= MAX_SIGNATURE_DATA_URL_LENGTH &&
      SIGNATURE_DATA_URL_PATTERN.test(value))
  );
}

function parseSignatureSource(value: unknown, fallback: string) {
  const signatureSrc = normaliseCell(value);

  if (!signatureSrc) {
    return fallback;
  }

  return isAllowedSignatureSource(signatureSrc) ? signatureSrc : fallback;
}

function normaliseSignatureSource(value: unknown, fallback: string) {
  const signatureSrc = normaliseCell(value);

  if (!signatureSrc) {
    return fallback;
  }

  if (!isAllowedSignatureSource(signatureSrc)) {
    throw new Error(
      "Signature image must be a PNG, JPEG or WebP data image under 48 KB after compression.",
    );
  }

  return signatureSrc;
}

export function slugifyEventName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function eventToSheetRow(event: CertificateEvent) {
  return [
    event.eventName,
    event.slug,
    event.homeLinkLabel,
    event.pageTitle,
    event.pageDescription,
    event.sheetTabName,
    event.certificateIdPrefix,
    String(event.certificateIdDigits),
    event.certificateIdExample,
    event.eventDate,
    event.issueDate,
    event.letterTitle,
    event.letterBody.join("\n\n"),
    event.signatories[0].name,
    event.signatories[0].designation,
    event.signatories[1].name,
    event.signatories[1].designation,
    event.qrInstructions.join("\n"),
    event.status,
    event.verifyButtonLabel,
    event.signatories[0].signatureSrc,
    event.signatories[1].signatureSrc,
  ];
}

export function sheetRowToEvent(headers: string[], row: string[]) {
  const eventName = normaliseCell(getValue(headers, row, "Event Name"));
  const explicitSlug = normaliseCell(getValue(headers, row, "Slug"));
  const slug = slugifyEventName(explicitSlug || eventName);
  const sheetTabName = normaliseCell(getValue(headers, row, "Sheet Tab Name"));
  const certificateIdPrefix = normaliseCell(
    getValue(headers, row, "Certificate Prefix"),
  );

  if (!eventName || !slug || !sheetTabName || !certificateIdPrefix) {
    return null;
  }

  const certificateIdDigits = parsePositiveInteger(
    getValue(headers, row, "ID Digits"),
    3,
  );
  const certificateIdExample = padCertificateExample(
    normaliseCell(getValue(headers, row, "Certificate ID Example")),
    certificateIdDigits,
  );
  const pageTitle =
    normaliseCell(getValue(headers, row, "Page Title")) ||
    `${eventName} eCertificate Verification`;
  const homeLinkLabel =
    normaliseCell(getValue(headers, row, "Home Link Label")) ||
    `Verify ${eventName} eCertificates`;
  const pageDescription =
    normaliseCell(getValue(headers, row, "Page Description")) ||
    `Enter only the final ID printed after ${certificateIdPrefix}.`;
  const verifyButtonLabel =
    normaliseCell(getValue(headers, row, "Verify Button Label")) ||
    "Verify eCertificate";
  const signatoryOneName =
    normaliseCell(getValue(headers, row, "Signatory 1 Name")) ||
    DEFAULT_SIGNATORIES[0].name;
  const signatoryOneDesignation =
    normaliseCell(getValue(headers, row, "Signatory 1 Designation")) ||
    DEFAULT_SIGNATORIES[0].designation;
  const signatoryTwoName =
    normaliseCell(getValue(headers, row, "Signatory 2 Name")) ||
    DEFAULT_SIGNATORIES[1].name;
  const signatoryTwoDesignation =
    normaliseCell(getValue(headers, row, "Signatory 2 Designation")) ||
    DEFAULT_SIGNATORIES[1].designation;
  const signatoryOneSignatureSrc = parseSignatureSource(
    getValue(headers, row, "Signatory 1 Signature Image"),
    DEFAULT_SIGNATORIES[0].signatureSrc,
  );
  const signatoryTwoSignatureSrc = parseSignatureSource(
    getValue(headers, row, "Signatory 2 Signature Image"),
    DEFAULT_SIGNATORIES[1].signatureSrc,
  );

  return {
    slug,
    homeLinkLabel,
    pageTitle,
    pageDescription,
    sheetTabName,
    certificateIdPrefix,
    certificateIdDigits,
    certificateIdExample,
    verifyButtonLabel,
    eventName,
    eventDate: normaliseCell(getValue(headers, row, "Event Date")),
    issueDate: normaliseCell(getValue(headers, row, "Issue Date")),
    letterTitle:
      normaliseCell(getValue(headers, row, "Letter Title")) ||
      "LETTER OF APPRECIATION",
    letterBody: splitParagraphs(
      getValue(headers, row, "Letter Body"),
      DEFAULT_LETTER_BODY,
    ),
    qrInstructions: splitLines(
      getValue(headers, row, "QR Instructions"),
      DEFAULT_QR_INSTRUCTIONS,
    ),
    signatories: [
      {
        ...DEFAULT_SIGNATORIES[0],
        name: signatoryOneName,
        designation: signatoryOneDesignation,
        signatureSrc: signatoryOneSignatureSrc,
        signatureAlt: `Signature of ${signatoryOneName}`,
      },
      {
        ...DEFAULT_SIGNATORIES[1],
        name: signatoryTwoName,
        designation: signatoryTwoDesignation,
        signatureSrc: signatoryTwoSignatureSrc,
        signatureAlt: `Signature of ${signatoryTwoName}`,
      },
    ],
    status: parseStatus(getValue(headers, row, "Status")),
  } satisfies CertificateEvent;
}

export function normaliseCertificateEvent(input: unknown): CertificateEvent {
  const body = typeof input === "object" && input !== null ? input : {};
  const getString = (key: keyof CertificateEvent, fallback = "") => {
    const value = (body as Record<string, unknown>)[key];
    return typeof value === "string" ? value.trim() : fallback;
  };
  const eventName = getString("eventName");
  const slug = slugifyEventName(getString("slug") || eventName);
  const sheetTabName = getString("sheetTabName");
  const certificateIdPrefix = getString("certificateIdPrefix");
  const certificateIdDigits = parsePositiveInteger(
    (body as Record<string, unknown>).certificateIdDigits,
    3,
  );
  const certificateIdExample = padCertificateExample(
    getString("certificateIdExample"),
    certificateIdDigits,
  );

  if (!eventName || !slug || !sheetTabName || !certificateIdPrefix) {
    throw new Error(
      "Event Name, Slug, Sheet Tab Name and Certificate Prefix are required.",
    );
  }

  const signatoriesInput = Array.isArray(
    (body as Record<string, unknown>).signatories,
  )
    ? ((body as Record<string, unknown>).signatories as unknown[])
    : [];
  const signatories = DEFAULT_SIGNATORIES.map((defaultSignatory, index) => {
    const signatory =
      typeof signatoriesInput[index] === "object" &&
      signatoriesInput[index] !== null
        ? (signatoriesInput[index] as Record<string, unknown>)
        : {};

    return {
      ...defaultSignatory,
      name:
        typeof signatory.name === "string" && signatory.name.trim()
          ? signatory.name.trim()
          : defaultSignatory.name,
      designation:
        typeof signatory.designation === "string" &&
        signatory.designation.trim()
          ? signatory.designation.trim()
          : defaultSignatory.designation,
      signatureSrc: normaliseSignatureSource(
        signatory.signatureSrc,
        defaultSignatory.signatureSrc,
      ),
      signatureAlt:
        typeof signatory.signatureAlt === "string" && signatory.signatureAlt.trim()
          ? signatory.signatureAlt.trim()
          : `Signature of ${
              typeof signatory.name === "string" && signatory.name.trim()
                ? signatory.name.trim()
                : defaultSignatory.name
            }`,
    };
  }) as [CertificateSignatory, CertificateSignatory];

  const letterBodyInput = (body as Record<string, unknown>).letterBody;
  const qrInstructionsInput = (body as Record<string, unknown>).qrInstructions;

  return {
    slug,
    homeLinkLabel:
      getString("homeLinkLabel") || `Verify ${eventName} eCertificates`,
    pageTitle:
      getString("pageTitle") || `${eventName} eCertificate Verification`,
    pageDescription:
      getString("pageDescription") ||
      `Enter only the final ID printed after ${certificateIdPrefix}.`,
    sheetTabName,
    certificateIdPrefix,
    certificateIdDigits,
    certificateIdExample,
    verifyButtonLabel: getString("verifyButtonLabel") || "Verify eCertificate",
    eventName,
    eventDate: getString("eventDate"),
    issueDate: getString("issueDate"),
    letterTitle: getString("letterTitle") || "LETTER OF APPRECIATION",
    letterBody: Array.isArray(letterBodyInput)
      ? letterBodyInput.map((value) => normaliseCell(value)).filter(Boolean)
      : splitParagraphs(letterBodyInput, DEFAULT_LETTER_BODY),
    qrInstructions: Array.isArray(qrInstructionsInput)
      ? qrInstructionsInput.map((value) => normaliseCell(value)).filter(Boolean)
      : splitLines(qrInstructionsInput, DEFAULT_QR_INSTRUCTIONS),
    signatories,
    status: parseStatus((body as Record<string, unknown>).status),
  };
}

export function getCertificateEventFromList(
  events: readonly CertificateEvent[],
  slug: string,
) {
  return events.find((event) => event.slug === slug) ?? null;
}

export function getDefaultCertificateEvent() {
  return fallbackCertificateEvents[0];
}

export function getCertificateEvent(slug: string) {
  return getCertificateEventFromList(fallbackCertificateEvents, slug);
}
