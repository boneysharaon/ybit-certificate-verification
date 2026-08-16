import { createSign } from "node:crypto";
import {
  EVENTS_SHEET_HEADERS,
  EVENTS_SHEET_NAME,
  eventToSheetRow,
  fallbackCertificateEvents,
  getCertificateEventFromList,
  normaliseCertificateEvent,
  sheetRowToEvent,
  type CertificateEvent,
} from "@/lib/certificateEvents";
import { validateAndNormalizeLetterId } from "@/lib/letterId";
import type { CertificateLookupResult, CertificateRecord } from "@/lib/types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_SHEETS_WRITE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

type SheetsConfig = {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
};

type CertificateLookupOptions = {
  tabName?: string;
  certificateIdPrefix?: string;
  certificateIdDigits?: number;
  certificateIdExample?: string;
};

type EventListOptions = {
  includeDraft?: boolean;
  fallbackToStatic?: boolean;
};

type GoogleTokenResponse = {
  access_token?: unknown;
};

type SheetValuesResponse = {
  values?: unknown;
};

type SpreadsheetMetadataResponse = {
  sheets?: Array<{
    properties?: {
      gridProperties?: {
        columnCount?: number;
        frozenRowCount?: number;
        rowCount?: number;
      };
      sheetId?: number;
      title?: string;
    };
  }>;
};

export class SheetsConfigurationError extends Error {
  constructor() {
    super("Google Sheets verification is not configured correctly.");
    this.name = "SheetsConfigurationError";
  }
}

export class SheetsRequestError extends Error {
  constructor(message = "Google Sheets verification request failed.") {
    super(message);
    this.name = "SheetsRequestError";
  }
}

function getConfig(): SheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const serviceAccountEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    throw new SheetsConfigurationError();
  }

  return {
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
  };
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createServiceAccountJwt(config: SheetsConfig, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: config.serviceAccountEmail,
    scope,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claimSet),
  )}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${base64UrlEncode(signer.sign(config.privateKey))}`;
}

async function getAccessToken(
  config: SheetsConfig,
  scope = GOOGLE_SHEETS_READONLY_SCOPE,
) {
  const assertion = createServiceAccountJwt(config, scope);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new SheetsRequestError();
  }

  const data = (await response.json()) as GoogleTokenResponse;

  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new SheetsRequestError();
  }

  return data.access_token;
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function sheetRange(sheetName: string, range: string) {
  return `${quoteSheetName(sheetName)}!${range}`;
}

function spreadsheetColumnName(columnNumber: number) {
  let columnName = "";
  let current = columnNumber;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    current = Math.floor((current - 1) / 26);
  }

  return columnName;
}

const EVENTS_SHEET_LAST_COLUMN = spreadsheetColumnName(
  EVENTS_SHEET_HEADERS.length,
);
const EVENTS_STATUS_COLUMN_INDEX = EVENTS_SHEET_HEADERS.indexOf("Status");
const EVENTS_CERTIFICATE_TYPE_COLUMN_INDEX =
  EVENTS_SHEET_HEADERS.indexOf("Certificate Type");
const EVENTS_MERIT_AWARD_TERM_COLUMN_INDEX =
  EVENTS_SHEET_HEADERS.indexOf("Merit Award Term");

function spreadsheetUrl(config: SheetsConfig, path = "") {
  return `${GOOGLE_SHEETS_API_URL}/${encodeURIComponent(
    config.spreadsheetId,
  )}${path}`;
}

async function googleSheetsFetch(
  config: SheetsConfig,
  path: string,
  options: RequestInit & { scope?: string } = {},
) {
  const accessToken = await getAccessToken(
    config,
    options.scope ?? GOOGLE_SHEETS_READONLY_SCOPE,
  );
  const { scope: ignoredScope, headers, ...fetchOptions } = options;
  void ignoredScope;

  const response = await fetch(spreadsheetUrl(config, path), {
    ...fetchOptions,
    headers: {
      ...(headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new SheetsRequestError();
  }

  return response;
}

function getHeadingIndex(headers: string[], expectedHeading: string) {
  return headers.findIndex(
    (heading) => heading.trim().toLowerCase() === expectedHeading,
  );
}

function getFirstHeadingIndex(headers: string[], expectedHeadings: string[]) {
  for (const heading of expectedHeadings) {
    const index = getHeadingIndex(headers, heading);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function normaliseRows(values: unknown): string[][] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : [],
  );
}

async function readValues(
  tabName: string,
  range: string,
): Promise<string[][]> {
  const config = getConfig();
  const a1Range = sheetRange(tabName, range);
  const valuesPath = `/values/${encodeURIComponent(a1Range)}?majorDimension=ROWS`;
  const response = await googleSheetsFetch(config, valuesPath);
  const data = (await response.json()) as SheetValuesResponse;
  return normaliseRows(data.values);
}

async function writeValues(
  tabName: string,
  range: string,
  values: string[][],
) {
  const config = getConfig();
  const a1Range = sheetRange(tabName, range);
  const valuesPath = `/values/${encodeURIComponent(
    a1Range,
  )}?valueInputOption=USER_ENTERED`;

  await googleSheetsFetch(config, valuesPath, {
    method: "PUT",
    scope: GOOGLE_SHEETS_WRITE_SCOPE,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
}

async function batchUpdate(requests: Record<string, unknown>[]) {
  const config = getConfig();

  await googleSheetsFetch(config, ":batchUpdate", {
    method: "POST",
    scope: GOOGLE_SHEETS_WRITE_SCOPE,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
}

async function getSpreadsheetMetadata() {
  const config = getConfig();
  const response = await googleSheetsFetch(
    config,
    "?fields=sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount,frozenRowCount))",
  );
  return (await response.json()) as SpreadsheetMetadataResponse;
}

function getEventsSheet(metadata: SpreadsheetMetadataResponse) {
  return (
    metadata.sheets?.find(
      (sheet) => sheet.properties?.title === EVENTS_SHEET_NAME,
    )?.properties ?? null
  );
}

async function formatEventsSheet(sheetId: number) {
  await batchUpdate([
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: EVENTS_SHEET_HEADERS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: {
              rgbColor: {
                red: 0.06,
                green: 0.36,
                blue: 0.31,
              },
            },
            textFormat: {
              bold: true,
              foregroundColorStyle: {
                rgbColor: {
                  red: 1,
                  green: 1,
                  blue: 1,
                },
              },
            },
            wrapStrategy: "WRAP",
          },
        },
        fields:
          "userEnteredFormat(backgroundColorStyle,textFormat,wrapStrategy)",
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: EVENTS_STATUS_COLUMN_INDEX,
          endColumnIndex: EVENTS_STATUS_COLUMN_INDEX + 1,
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: [
              { userEnteredValue: "Published" },
              { userEnteredValue: "Draft" },
              { userEnteredValue: "Archived" },
            ],
          },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: EVENTS_CERTIFICATE_TYPE_COLUMN_INDEX,
          endColumnIndex: EVENTS_CERTIFICATE_TYPE_COLUMN_INDEX + 1,
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: [
              { userEnteredValue: "Appreciation" },
              { userEnteredValue: "Participation" },
              { userEnteredValue: "Merit" },
            ],
          },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: EVENTS_MERIT_AWARD_TERM_COLUMN_INDEX,
          endColumnIndex: EVENTS_MERIT_AWARD_TERM_COLUMN_INDEX + 1,
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: [
              { userEnteredValue: "Rank" },
              { userEnteredValue: "Position" },
              { userEnteredValue: "Prize" },
            ],
          },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: EVENTS_SHEET_HEADERS.length,
        },
      },
    },
  ]);
}

export async function ensureEventsSheet() {
  let metadata = await getSpreadsheetMetadata();
  let eventsSheet = getEventsSheet(metadata);

  if (!eventsSheet?.sheetId) {
    await batchUpdate([
      {
        addSheet: {
          properties: {
            title: EVENTS_SHEET_NAME,
            gridProperties: {
              rowCount: 1000,
              columnCount: EVENTS_SHEET_HEADERS.length,
            },
          },
        },
      },
    ]);
    metadata = await getSpreadsheetMetadata();
    eventsSheet = getEventsSheet(metadata);
  }

  if (!eventsSheet?.sheetId) {
    throw new SheetsRequestError("Could not create the Events sheet.");
  }

  if (
    (eventsSheet.gridProperties?.columnCount ?? 0) <
    EVENTS_SHEET_HEADERS.length
  ) {
    await batchUpdate([
      {
        updateSheetProperties: {
          properties: {
            sheetId: eventsSheet.sheetId,
            gridProperties: {
              columnCount: EVENTS_SHEET_HEADERS.length,
            },
          },
          fields: "gridProperties.columnCount",
        },
      },
    ]);
  }

  await writeValues(EVENTS_SHEET_NAME, `A1:${EVENTS_SHEET_LAST_COLUMN}1`, [
    [...EVENTS_SHEET_HEADERS],
  ]);
  await formatEventsSheet(eventsSheet.sheetId);

  return eventsSheet.sheetId;
}

function parseCertificateRows(
  values: unknown,
  normalizedLetterId: string,
  options: Required<Pick<
    CertificateLookupOptions,
    "certificateIdPrefix" | "certificateIdDigits" | "certificateIdExample"
  >>,
): CertificateLookupResult {
  const rows = normaliseRows(values);

  if (rows.length === 0) {
    return {
      found: false,
      status: "not_found",
    };
  }

  const headers = rows[0];
  const letterIdIndex = getHeadingIndex(headers, "letter id");
  const studentNameIndex = getHeadingIndex(headers, "student name");
  const classIndex = getHeadingIndex(headers, "class");
  const branchIndex = getHeadingIndex(headers, "branch");
  const statusIndex = getHeadingIndex(headers, "status");
  const meritRankIndex = getFirstHeadingIndex(headers, [
    "rank",
    "position",
    "prize",
    "award",
    "result",
    "merit rank",
    "merit position",
    "merit prize",
  ]);
  const meritCategoryIndex = getFirstHeadingIndex(headers, [
    "event/category",
    "event category",
    "category",
    "competition",
    "event",
    "activity",
  ]);

  if (letterIdIndex < 0 || studentNameIndex < 0 || classIndex < 0) {
    throw new SheetsConfigurationError();
  }

  for (const row of rows.slice(1)) {
    const rowLetterId = validateAndNormalizeLetterId(row[letterIdIndex], {
      prefix: options.certificateIdPrefix,
      digits: options.certificateIdDigits,
      example: options.certificateIdExample,
    });

    if (!rowLetterId.ok || rowLetterId.value !== normalizedLetterId) {
      continue;
    }

    const studentName = row[studentNameIndex]?.trim();
    const classValue = row[classIndex]?.trim();
    const branchValue = branchIndex >= 0 ? row[branchIndex]?.trim() : "";
    const className = branchValue ? `${classValue} ${branchValue}` : classValue;

    if (!studentName || !className) {
      throw new SheetsConfigurationError();
    }

    const status =
      statusIndex >= 0 ? row[statusIndex]?.trim().toLowerCase() : "";

    if (status === "revoked") {
      return {
        found: true,
        status: "revoked",
      };
    }

    const certificate: CertificateRecord = {
      letterId: normalizedLetterId,
      studentName,
      className,
    };
    const meritRank =
      meritRankIndex >= 0 ? row[meritRankIndex]?.trim() : "";
    const meritCategory =
      meritCategoryIndex >= 0 ? row[meritCategoryIndex]?.trim() : "";

    if (meritRank) {
      certificate.meritRank = meritRank;
    }

    if (meritCategory) {
      certificate.meritCategory = meritCategory;
    }

    return {
      found: true,
      status: "valid",
      certificate,
    };
  }

  return {
    found: false,
    status: "not_found",
  };
}

function parseEventsRows(rows: string[][]) {
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0];
  return rows
    .slice(1)
    .map((row) => sheetRowToEvent(headers, row))
    .filter((event): event is CertificateEvent => event !== null);
}

export async function getCertificateEvents({
  includeDraft = false,
  fallbackToStatic = true,
}: EventListOptions = {}) {
  try {
    const rows = await readValues(EVENTS_SHEET_NAME, `A:${EVENTS_SHEET_LAST_COLUMN}`);
    const events = parseEventsRows(rows).filter(
      (event) => includeDraft || event.status === "Published",
    );

    if (events.length > 0) {
      return events;
    }
  } catch (error) {
    if (!fallbackToStatic) {
      throw error;
    }
  }

  return fallbackCertificateEvents.filter(
    (event) => includeDraft || event.status === "Published",
  );
}

export async function getCertificateEventBySlug(
  slug: string,
  options: EventListOptions = {},
) {
  const events = await getCertificateEvents(options);
  return getCertificateEventFromList(events, slug);
}

export async function getDefaultPublishedCertificateEvent() {
  const events = await getCertificateEvents();
  return events[0] ?? fallbackCertificateEvents[0];
}

export async function upsertCertificateEvent(input: unknown) {
  const event = normaliseCertificateEvent(input);
  await ensureEventsSheet();

  const rows = await readValues(EVENTS_SHEET_NAME, `A:${EVENTS_SHEET_LAST_COLUMN}`);
  const headers = rows[0] ?? [...EVENTS_SHEET_HEADERS];
  const slugIndex = getHeadingIndex(headers, "slug");
  const existingRowIndex =
    slugIndex >= 0
      ? rows.findIndex((row, index) => index > 0 && row[slugIndex] === event.slug)
      : -1;
  const targetRowNumber =
    existingRowIndex >= 0 ? existingRowIndex + 1 : Math.max(rows.length + 1, 2);

  await writeValues(
    EVENTS_SHEET_NAME,
    `A${targetRowNumber}:${EVENTS_SHEET_LAST_COLUMN}${targetRowNumber}`,
    [eventToSheetRow(event)],
  );

  return event;
}

export async function getCertificateByLetterId(
  normalizedLetterId: string,
  options: CertificateLookupOptions = {},
): Promise<CertificateLookupResult> {
  const tabName =
    options.tabName?.trim() ||
    process.env.GOOGLE_SHEETS_TAB_NAME?.trim() ||
    "Certificates";
  const certificateIdPrefix =
    options.certificateIdPrefix ?? "YBIT/CulturalDept/YF/V/";
  const certificateIdDigits = options.certificateIdDigits ?? 3;
  const certificateIdExample = options.certificateIdExample ?? "001";
  const rows = await readValues(tabName, "A:E");

  return parseCertificateRows(rows, normalizedLetterId, {
    certificateIdPrefix,
    certificateIdDigits,
    certificateIdExample,
  });
}
