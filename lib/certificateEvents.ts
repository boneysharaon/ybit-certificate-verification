export type CertificateEventStatus = "Published" | "Draft" | "Archived";
export type CertificateType =
  | "Appreciation"
  | "Participation"
  | "Merit"
  | "Recognition";
export type MeritAwardTerm = "Rank" | "Position" | "Prize";
export type CertificateOrientation = "Portrait" | "Landscape";
export type CertificateTheme =
  | "Classic"
  | "Formal"
  | "Modern"
  | "Celebration";

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
  certificateType: CertificateType;
  meritAwardTerm: MeritAwardTerm;
  eventDate: string;
  issueDate: string;
  letterTitle: string;
  letterBody: string[];
  qrInstructions: string[];
  signatories: [CertificateSignatory, CertificateSignatory];
  certificateOrientation: CertificateOrientation;
  certificateTheme: CertificateTheme;
  leftLogoSrc: string;
  rightLogoSrc: string;
  signatoryOneScale: number;
  signatoryTwoScale: number;
  titleOffsetX: number;
  titleOffsetY: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
  qrOffsetX: number;
  qrOffsetY: number;
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
  "Certificate Type",
  "Merit Award Term",
  "Certificate Orientation",
  "Certificate Theme",
  "Left Logo Image",
  "Right Logo Image",
  "Signatory 1 Scale",
  "Signatory 2 Scale",
  "Title Offset X",
  "Title Offset Y",
  "Body Offset X",
  "Body Offset Y",
  "QR Offset X",
  "QR Offset Y",
] as const;

const MAX_SIGNATURE_DATA_URL_LENGTH = 48_000;
const SIGNATURE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;
export const REMOVED_IMAGE_SOURCE = "none";
export const DEFAULT_LEFT_LOGO_SRC = "/ybit-logo.png";
export const DEFAULT_RIGHT_LOGO_SRC = "/mumbai-university-logo.png";
export const certificateOrientations = ["Portrait", "Landscape"] as const;
export const certificateThemes = [
  "Classic",
  "Formal",
  "Modern",
  "Celebration",
] as const;

const DEFAULT_LETTER_BODY = [
  "This is to place on record our sincere appreciation for {{studentName}}, a student of {{className}}, for volunteering during the {{eventName}} held at Yashwantrao Bhonsale Institute of Technology, Sawantwadi, on {{eventDate}}.",
  "The Cultural Committee gratefully acknowledges the student's dedication, responsible service and valuable contribution, which helped in the smooth conduct of the programme and in making the event a grand success.",
  "We sincerely thank the student for their help in making the event a grand success.",
];

const DEFAULT_PARTICIPATION_LETTER_BODY = [
  "This is to certify that {{studentName}}, a student of {{className}}, participated in the {{eventName}} held at Yashwantrao Bhonsale Institute of Technology, Sawantwadi, on {{eventDate}}.",
  "The institute appreciates the student's active participation and contribution to the successful conduct of the programme.",
];

const DEFAULT_MERIT_LETTER_BODY = [
  "This is to certify that {{studentName}}, a student of {{className}}, secured {{meritRank}} {{meritAwardTerm}} in {{meritCategory}} during the {{eventName}} held at Yashwantrao Bhonsale Institute of Technology, Sawantwadi, on {{eventDate}}.",
  "The institute congratulates the student on this achievement and wishes continued success in future endeavours.",
];

const DEFAULT_RECOGNITION_LETTER_BODY = [
  "This is to certify that {{recipientName}}, {{recipientContext}}, rendered dedicated service as {{recognitionRole}} of {{recognitionBodyName}} {{recognitionBodyType}} for the academic year {{recognitionAcademicYear}}{{recognitionTermText}}.",
  "The institute appreciates this contribution and acknowledges the commitment shown during the stated period.",
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
    certificateType: "Appreciation",
    meritAwardTerm: "Prize",
    eventDate: "08/08/2026",
    issueDate: "08/08/2026",
    letterTitle: "LETTER OF APPRECIATION",
    letterBody: DEFAULT_LETTER_BODY,
    qrInstructions: DEFAULT_QR_INSTRUCTIONS,
    signatories: DEFAULT_SIGNATORIES,
    certificateOrientation: "Portrait",
    certificateTheme: "Classic",
    leftLogoSrc: DEFAULT_LEFT_LOGO_SRC,
    rightLogoSrc: DEFAULT_RIGHT_LOGO_SRC,
    signatoryOneScale: 0.88,
    signatoryTwoScale: 0.82,
    titleOffsetX: 0,
    titleOffsetY: 0,
    bodyOffsetX: 0,
    bodyOffsetY: 0,
    qrOffsetX: 0,
    qrOffsetY: 0,
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

function assertValidSheetTabName(value: string) {
  if (value.length > 100 || /[:\\/?*\[\]]/.test(value)) {
    throw new Error(
      "Sheet Tab Name must be 100 characters or fewer and cannot contain : \\ / ? * [ or ].",
    );
  }
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

function parseCertificateType(value: unknown): CertificateType {
  const normalised = normaliseCell(value).toLowerCase();

  if (normalised === "merit" || normalised === "certificate of merit") {
    return "Merit";
  }

  if (
    normalised === "recognition" ||
    normalised === "certificate of recognition"
  ) {
    return "Recognition";
  }

  if (
    normalised === "participation" ||
    normalised === "certificate of participation"
  ) {
    return "Participation";
  }

  return "Appreciation";
}

function parseMeritAwardTerm(value: unknown): MeritAwardTerm {
  const normalised = normaliseCell(value).toLowerCase();

  if (normalised === "rank") {
    return "Rank";
  }

  if (normalised === "position") {
    return "Position";
  }

  return "Prize";
}

function parseCertificateOrientation(value: unknown): CertificateOrientation {
  return normaliseCell(value).toLowerCase() === "landscape"
    ? "Landscape"
    : "Portrait";
}

function parseCertificateTheme(value: unknown): CertificateTheme {
  const normalised = normaliseCell(value).toLowerCase();

  if (normalised === "formal") {
    return "Formal";
  }

  if (normalised === "modern") {
    return "Modern";
  }

  if (normalised === "celebration") {
    return "Celebration";
  }

  return "Classic";
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
    value === REMOVED_IMAGE_SOURCE ||
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

function parseBoundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseFloat(normaliseCell(value));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function getDefaultLetterTitleForCertificateType(
  certificateType: CertificateType,
) {
  if (certificateType === "Merit") {
    return "CERTIFICATE OF MERIT";
  }

  if (certificateType === "Recognition") {
    return "CERTIFICATE OF RECOGNITION";
  }

  if (certificateType === "Participation") {
    return "CERTIFICATE OF PARTICIPATION";
  }

  return "LETTER OF APPRECIATION";
}

export function getDefaultLetterBodyForCertificateType(
  certificateType: CertificateType,
) {
  if (certificateType === "Merit") {
    return [...DEFAULT_MERIT_LETTER_BODY];
  }

  if (certificateType === "Recognition") {
    return [...DEFAULT_RECOGNITION_LETTER_BODY];
  }

  if (certificateType === "Participation") {
    return [...DEFAULT_PARTICIPATION_LETTER_BODY];
  }

  return [...DEFAULT_LETTER_BODY];
}

export function getCertificateDataHeaders(event: Pick<
  CertificateEvent,
  "certificateType" | "meritAwardTerm"
>) {
  const baseHeaders = ["Letter ID", "Student Name", "Class", "Branch"];

  if (event.certificateType === "Merit") {
    return [...baseHeaders, event.meritAwardTerm, "Event/Category", "Status"];
  }

  if (event.certificateType === "Recognition") {
    return [
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
    ];
  }

  return [...baseHeaders, "Status"];
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
    event.certificateType,
    event.meritAwardTerm,
    event.certificateOrientation,
    event.certificateTheme,
    event.leftLogoSrc,
    event.rightLogoSrc,
    String(event.signatoryOneScale),
    String(event.signatoryTwoScale),
    String(event.titleOffsetX),
    String(event.titleOffsetY),
    String(event.bodyOffsetX),
    String(event.bodyOffsetY),
    String(event.qrOffsetX),
    String(event.qrOffsetY),
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
  const certificateType = parseCertificateType(
    getValue(headers, row, "Certificate Type"),
  );
  const meritAwardTerm = parseMeritAwardTerm(
    getValue(headers, row, "Merit Award Term"),
  );
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
  const defaultEvent = fallbackCertificateEvents[0];

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
    certificateType,
    meritAwardTerm,
    eventDate: normaliseCell(getValue(headers, row, "Event Date")),
    issueDate: normaliseCell(getValue(headers, row, "Issue Date")),
    letterTitle:
      normaliseCell(getValue(headers, row, "Letter Title")) ||
      getDefaultLetterTitleForCertificateType(certificateType),
    letterBody: splitParagraphs(
      getValue(headers, row, "Letter Body"),
      getDefaultLetterBodyForCertificateType(certificateType),
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
    certificateOrientation: parseCertificateOrientation(
      getValue(headers, row, "Certificate Orientation"),
    ),
    certificateTheme: parseCertificateTheme(
      getValue(headers, row, "Certificate Theme"),
    ),
    leftLogoSrc: parseSignatureSource(
      getValue(headers, row, "Left Logo Image"),
      defaultEvent.leftLogoSrc,
    ),
    rightLogoSrc: parseSignatureSource(
      getValue(headers, row, "Right Logo Image"),
      defaultEvent.rightLogoSrc,
    ),
    signatoryOneScale: parseBoundedNumber(
      getValue(headers, row, "Signatory 1 Scale"),
      defaultEvent.signatoryOneScale,
      0.5,
      2,
    ),
    signatoryTwoScale: parseBoundedNumber(
      getValue(headers, row, "Signatory 2 Scale"),
      defaultEvent.signatoryTwoScale,
      0.5,
      2,
    ),
    titleOffsetX: parseBoundedNumber(
      getValue(headers, row, "Title Offset X"),
      0,
      -180,
      180,
    ),
    titleOffsetY: parseBoundedNumber(
      getValue(headers, row, "Title Offset Y"),
      0,
      -180,
      180,
    ),
    bodyOffsetX: parseBoundedNumber(
      getValue(headers, row, "Body Offset X"),
      0,
      -180,
      180,
    ),
    bodyOffsetY: parseBoundedNumber(
      getValue(headers, row, "Body Offset Y"),
      0,
      -180,
      180,
    ),
    qrOffsetX: parseBoundedNumber(
      getValue(headers, row, "QR Offset X"),
      0,
      -180,
      180,
    ),
    qrOffsetY: parseBoundedNumber(
      getValue(headers, row, "QR Offset Y"),
      0,
      -180,
      180,
    ),
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
  const certificateType = parseCertificateType(
    (body as Record<string, unknown>).certificateType,
  );
  const meritAwardTerm = parseMeritAwardTerm(
    (body as Record<string, unknown>).meritAwardTerm,
  );
  const defaultEvent = fallbackCertificateEvents[0];

  if (!eventName || !slug || !sheetTabName || !certificateIdPrefix) {
    throw new Error(
      "Event Name, Slug, Sheet Tab Name and Certificate Prefix are required.",
    );
  }

  assertValidSheetTabName(sheetTabName);

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
    certificateType,
    meritAwardTerm,
    eventDate: getString("eventDate"),
    issueDate: getString("issueDate"),
    letterTitle:
      getString("letterTitle") ||
      getDefaultLetterTitleForCertificateType(certificateType),
    letterBody: Array.isArray(letterBodyInput)
      ? letterBodyInput.map((value) => normaliseCell(value)).filter(Boolean)
      : splitParagraphs(
          letterBodyInput,
          getDefaultLetterBodyForCertificateType(certificateType),
        ),
    qrInstructions: Array.isArray(qrInstructionsInput)
      ? qrInstructionsInput.map((value) => normaliseCell(value)).filter(Boolean)
      : splitLines(qrInstructionsInput, DEFAULT_QR_INSTRUCTIONS),
    signatories,
    certificateOrientation: parseCertificateOrientation(
      (body as Record<string, unknown>).certificateOrientation,
    ),
    certificateTheme: parseCertificateTheme(
      (body as Record<string, unknown>).certificateTheme,
    ),
    leftLogoSrc: normaliseSignatureSource(
      (body as Record<string, unknown>).leftLogoSrc,
      defaultEvent.leftLogoSrc,
    ),
    rightLogoSrc: normaliseSignatureSource(
      (body as Record<string, unknown>).rightLogoSrc,
      defaultEvent.rightLogoSrc,
    ),
    signatoryOneScale: parseBoundedNumber(
      (body as Record<string, unknown>).signatoryOneScale,
      defaultEvent.signatoryOneScale,
      0.5,
      2,
    ),
    signatoryTwoScale: parseBoundedNumber(
      (body as Record<string, unknown>).signatoryTwoScale,
      defaultEvent.signatoryTwoScale,
      0.5,
      2,
    ),
    titleOffsetX: parseBoundedNumber(
      (body as Record<string, unknown>).titleOffsetX,
      0,
      -180,
      180,
    ),
    titleOffsetY: parseBoundedNumber(
      (body as Record<string, unknown>).titleOffsetY,
      0,
      -180,
      180,
    ),
    bodyOffsetX: parseBoundedNumber(
      (body as Record<string, unknown>).bodyOffsetX,
      0,
      -180,
      180,
    ),
    bodyOffsetY: parseBoundedNumber(
      (body as Record<string, unknown>).bodyOffsetY,
      0,
      -180,
      180,
    ),
    qrOffsetX: parseBoundedNumber(
      (body as Record<string, unknown>).qrOffsetX,
      0,
      -180,
      180,
    ),
    qrOffsetY: parseBoundedNumber(
      (body as Record<string, unknown>).qrOffsetY,
      0,
      -180,
      180,
    ),
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
