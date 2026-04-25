import { createSign } from "node:crypto";

import {
  appendGenericFormSubmission,
  GenericFormSubmissionRecord,
} from "@/lib/server/generic-form-submissions-store";

type GenericFormSubmissionMode = "auto" | "local_dev" | "google_sheets";

type GenericFormResponse = {
  id: string;
  label: string;
  value: string | string[];
};

type GenericFormSubmitInput = {
  submittedAt: string;
  slug: string;
  formTitle: string;
  formId: string;
  responses: GenericFormResponse[];
};

type GoogleSheetAppendResult = {
  tabName: string;
  updatedRange: string | null;
  updatedRows: number | null;
  rowNumber: number | null;
};

const DEFAULT_STATUS = "new";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const isDevelopment = process.env.NODE_ENV !== "production";

const base64UrlEncode = (value: string): string => Buffer.from(value).toString("base64url");

const getAdapterMode = (): GenericFormSubmissionMode => {
  const raw = (process.env.GENERIC_FORM_SUBMISSION_ADAPTER_MODE ?? "auto").trim().toLowerCase();
  if (raw === "local_dev" || raw === "google_sheets" || raw === "auto") {
    return raw;
  }
  return "auto";
};

const getGoogleConfig = () => {
  const spreadsheetId = (process.env.GOOGLE_SHEETS_SUPPORT_SPREADSHEET_ID ?? "").trim();
  const serviceEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
  const privateKeyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").trim();
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const genericFormsTab = (process.env.GOOGLE_SHEETS_GENERIC_FORMS_TAB ?? "Generic Forms").trim();

  return {
    spreadsheetId,
    serviceEmail,
    privateKey,
    genericFormsTab,
    configured: Boolean(spreadsheetId && serviceEmail && privateKey && genericFormsTab),
  };
};

const resolveEffectiveMode = (): "local_dev" | "google_sheets" => {
  const mode = getAdapterMode();
  const google = getGoogleConfig();
  if (mode === "local_dev") {
    return "local_dev";
  }
  if (mode === "google_sheets") {
    if (google.configured) {
      return "google_sheets";
    }
    throw new Error("Google Sheets adapter config is missing.");
  }
  if (google.configured) {
    return "google_sheets";
  }
  if (isDevelopment) {
    console.warn(
      "[generic-form-submission] Google Sheets config missing in auto mode. Falling back to local_dev (development only).",
    );
    return "local_dev";
  }
  throw new Error("Google Sheets adapter config is missing in production.");
};

const getUpdatedRangeRowNumber = (updatedRange: string | null): number | null => {
  const match = updatedRange?.match(/![A-Z]+(\d+)(?::|$)/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const getGoogleAccessToken = async (): Promise<string> => {
  const google = getGoogleConfig();
  if (!google.configured) {
    throw new Error("Google Sheets credentials are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: google.serviceEmail,
    scope: TOKEN_SCOPE,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(google.privateKey).toString("base64url");
  const assertion = `${unsigned}.${signature}`;

  const tokenResponse = await fetch(TOKEN_AUDIENCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Google auth failed (${tokenResponse.status}): ${body}`);
  }

  const parsed = (await tokenResponse.json()) as { access_token?: string };
  if (!parsed.access_token) {
    throw new Error("Google auth response missing access_token.");
  }
  return parsed.access_token;
};

const getSheetIdByTabName = async (
  spreadsheetId: string,
  tabName: string,
  token: string,
): Promise<number> => {
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets metadata fetch failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const matched = payload.sheets?.find((sheet) => sheet.properties?.title?.trim() === tabName);
  const sheetId = matched?.properties?.sheetId;
  if (typeof sheetId !== "number") {
    throw new Error(`Google Sheets tab not found: ${tabName}`);
  }
  return sheetId;
};

const insertRowAtTop = async (
  spreadsheetId: string,
  sheetId: number,
  token: string,
): Promise<void> => {
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets row insert failed (${response.status}): ${body}`);
  }
};

const updateSheetRowValues = async (params: {
  spreadsheetId: string;
  tabName: string;
  rowNumber: number;
  values: string[];
  token: string;
}): Promise<{ updatedRange: string | null; updatedRows: number | null }> => {
  const range = encodeURIComponent(`${params.tabName}!A${params.rowNumber}`);
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [params.values],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets row update failed (${response.status}): ${body}`);
  }
  const body = (await response.json().catch(() => null)) as
    | { updatedRange?: string; updatedRows?: number }
    | null;
  return {
    updatedRange: body?.updatedRange ?? null,
    updatedRows: body?.updatedRows ?? null,
  };
};

const appendGoogleSheetRow = async (
  tabName: string,
  values: string[],
): Promise<GoogleSheetAppendResult> => {
  const google = getGoogleConfig();
  if (!google.configured) {
    throw new Error("Google Sheets adapter config is missing.");
  }
  const token = await getGoogleAccessToken();
  const sheetId = await getSheetIdByTabName(google.spreadsheetId, tabName, token);
  await insertRowAtTop(google.spreadsheetId, sheetId, token);
  const targetRowNumber = 2;
  const updated = await updateSheetRowValues({
    spreadsheetId: google.spreadsheetId,
    tabName,
    rowNumber: targetRowNumber,
    values,
    token,
  });
  const updatedRange = updated.updatedRange ?? `${tabName}!A${targetRowNumber}`;
  return {
    tabName,
    updatedRange,
    updatedRows: updated.updatedRows,
    rowNumber: getUpdatedRangeRowNumber(updatedRange),
  };
};

const normalizeKey = (value: string): string => value.trim().toLowerCase().replace(/[\s_-]+/g, "");

const extractByAliases = (responses: GenericFormResponse[], aliases: string[]): string => {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias));
  const matched = responses.find((entry) => {
    const normalizedId = normalizeKey(entry.id);
    const normalizedLabel = normalizeKey(entry.label);
    return normalizedAliases.includes(normalizedId) || normalizedAliases.includes(normalizedLabel);
  });
  if (!matched) {
    return "";
  }
  return Array.isArray(matched.value) ? matched.value.join(", ").trim() : String(matched.value ?? "").trim();
};

const normalizeGenericFormRecord = (input: GenericFormSubmitInput): GenericFormSubmissionRecord => {
  const email = extractByAliases(input.responses, ["email", "e-mail", "อีเมล"]);
  const name = extractByAliases(input.responses, ["name", "full_name", "fullname", "ชื่อ", "ชื่อ-นามสกุล"]);
  const phone = extractByAliases(input.responses, [
    "phone",
    "mobile",
    "tel",
    "registered_phone",
    "เบอร์โทรศัพท์",
    "เบอร์โทรศัพท์ที่ลงทะเบียน",
  ]);
  const responsesJson = JSON.stringify(input.responses);
  const extraFields = input.responses.reduce<Record<string, string | string[]>>((accumulator, entry) => {
    const normalizedId = normalizeKey(entry.id);
    const normalizedLabel = normalizeKey(entry.label);
    const isReserved =
      ["email", "e-mail", "อีเมล"].some((item) => normalizeKey(item) === normalizedId || normalizeKey(item) === normalizedLabel) ||
      ["name", "full_name", "fullname", "ชื่อ", "ชื่อ-นามสกุล"].some(
        (item) => normalizeKey(item) === normalizedId || normalizeKey(item) === normalizedLabel,
      ) ||
      ["phone", "mobile", "tel", "registered_phone", "เบอร์โทรศัพท์", "เบอร์โทรศัพท์ที่ลงทะเบียน"].some(
        (item) => normalizeKey(item) === normalizedId || normalizeKey(item) === normalizedLabel,
      );
    if (!isReserved) {
      accumulator[entry.id] = entry.value;
    }
    return accumulator;
  }, {});

  return {
    submitted_at: input.submittedAt,
    slug: input.slug,
    form_title: input.formTitle,
    form_id: input.formId,
    email,
    name,
    phone,
    responses_json: responsesJson,
    extra_fields: JSON.stringify(extraFields),
    status: DEFAULT_STATUS,
  };
};

const writeToLocalDev = async (record: GenericFormSubmissionRecord): Promise<void> => {
  await appendGenericFormSubmission(record);
};

const writeToGoogleSheets = async (
  record: GenericFormSubmissionRecord,
): Promise<GoogleSheetAppendResult> => {
  const google = getGoogleConfig();
  return appendGoogleSheetRow(google.genericFormsTab, [
    record.submitted_at,
    record.slug,
    record.form_title,
    record.form_id,
    record.email,
    record.name,
    record.phone,
    record.responses_json,
    record.extra_fields,
    record.status,
  ]);
};

export const submitGenericFormSubmission = async (
  input: GenericFormSubmitInput,
): Promise<{
  ok: true;
  submittedAt: string;
  status: string;
  sheetTab: string | null;
  sheetRow: number | null;
}> => {
  const record = normalizeGenericFormRecord(input);
  const mode = resolveEffectiveMode();
  console.info("[generic-form-submission] normalized payload", {
    submitted_at: record.submitted_at,
    slug: record.slug,
    form_id: record.form_id,
    form_title: record.form_title,
    has_email: Boolean(record.email),
    has_name: Boolean(record.name),
    has_phone: Boolean(record.phone),
    status: record.status,
    mode,
  });

  if (mode === "local_dev") {
    await writeToLocalDev(record);
    return {
      ok: true,
      submittedAt: record.submitted_at,
      status: record.status,
      sheetTab: null,
      sheetRow: null,
    };
  }

  const appendResult = await writeToGoogleSheets(record);
  return {
    ok: true,
    submittedAt: record.submitted_at,
    status: record.status,
    sheetTab: appendResult.tabName,
    sheetRow: appendResult.rowNumber,
  };
};

