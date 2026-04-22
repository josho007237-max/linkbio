import { createSign } from "node:crypto";

import { appendSupportSubmission, SupportSubmissionRecord } from "@/lib/server/support-submissions-store";

export type SupportSubmissionAdapterMode = "auto" | "local_dev" | "google_sheets";

export type DepositIssueSubmission = {
  submittedAt: string;
  issueType: string;
  user: string;
  registeredPhone: string;
  fullName: string;
  slipUrl: string;
  transactionTime: string;
  note: string;
  status: string;
  metadata: {
    slug: string;
    linkId: string;
    formTitle: string;
    template: string;
  };
};

export type WithdrawIssueSubmission = {
  submittedAt: string;
  issueType: string;
  user: string;
  phone: string;
  fullName: string;
  bankAccount: string;
  transactionTime: string;
  note: string;
  status: string;
  metadata: {
    slug: string;
    linkId: string;
    formTitle: string;
    template: string;
  };
};

const DEFAULT_STATUS = "new";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const base64UrlEncode = (value: string): string =>
  Buffer.from(value).toString("base64url");

const getAdapterMode = (): SupportSubmissionAdapterMode => {
  const raw = (process.env.SUPPORT_SUBMISSION_ADAPTER_MODE ?? "auto")
    .trim()
    .toLowerCase();
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
  const depositTab = (process.env.GOOGLE_SHEETS_SUPPORT_DEPOSIT_TAB ?? "ฝากเงินไม่เข้า").trim();
  const withdrawTab = (process.env.GOOGLE_SHEETS_SUPPORT_WITHDRAW_TAB ?? "ถอนเงินไม่ได้").trim();

  return {
    spreadsheetId,
    serviceEmail,
    privateKey,
    depositTab,
    withdrawTab,
    configured: Boolean(spreadsheetId && serviceEmail && privateKey),
  };
};

const isDevelopment = process.env.NODE_ENV !== "production";

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
    if (isDevelopment) {
      console.warn(
        "[support-submission] Google Sheets mode requested but config missing. Falling back to local_dev.",
      );
      return "local_dev";
    }
    throw new Error("Google Sheets adapter config is missing.");
  }

  if (google.configured) {
    return "google_sheets";
  }
  if (isDevelopment) {
    console.warn(
      "[support-submission] Google Sheets config missing in auto mode. Falling back to local_dev (development only).",
    );
    return "local_dev";
  }
  throw new Error(
    "Google Sheets adapter config is missing in production (auto mode cannot fall back to local_dev).",
  );
};

const getGoogleAccessToken = async (): Promise<string> => {
  const google = getGoogleConfig();
  if (!google.configured) {
    throw new Error("Google Sheets credentials are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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

const appendGoogleSheetRow = async (tabName: string, values: string[]) => {
  const google = getGoogleConfig();
  if (!google.configured) {
    throw new Error("Google Sheets adapter config is missing.");
  }
  console.info("[support-submission] Google Sheets append target", {
    spreadsheetId: google.spreadsheetId,
    tabName,
    valuesCount: values.length,
  });
  const token = await getGoogleAccessToken();
  const range = encodeURIComponent(`${tabName}!A1`);
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${google.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[support-submission] Google Sheets append failed", {
      spreadsheetId: google.spreadsheetId,
      tabName,
      status: response.status,
      body,
    });
    throw new Error(`Google Sheets append failed (${response.status}): ${body}`);
  }
  const body = (await response.json().catch(() => null)) as
    | { updates?: { updatedRange?: string; updatedRows?: number } }
    | null;
  console.info("[support-submission] Google Sheets append success", {
    spreadsheetId: google.spreadsheetId,
    tabName,
    updatedRange: body?.updates?.updatedRange ?? null,
    updatedRows: body?.updates?.updatedRows ?? null,
  });
};

const getField = (
  fields: SupportSubmissionRecord["fields"],
  labels: string[],
): string => {
  const matched = fields.find((field) => labels.includes(field.label.trim()));
  if (!matched) {
    return "";
  }
  return Array.isArray(matched.value) ? matched.value.join(", ") : String(matched.value ?? "");
};

const writeDepositToLocalDev = async (input: DepositIssueSubmission): Promise<void> => {
  const record: SupportSubmissionRecord = {
    id: crypto.randomUUID(),
    kind: "deposit_issue",
    slug: input.metadata.slug,
    linkId: input.metadata.linkId,
    formTitle: input.metadata.formTitle,
    template: input.metadata.template,
    submittedAt: input.submittedAt,
    fields: [
      { id: "user", label: "USER", value: input.user },
      { id: "registered_phone", label: "เบอร์โทรศัพท์ที่ลงทะเบียน", value: input.registeredPhone },
      { id: "full_name", label: "ชื่อ-นามสกุล", value: input.fullName },
      { id: "slip_url", label: "แนบสลิปการทำรายการ", value: input.slipUrl },
      { id: "transaction_time", label: "เวลาที่ทำรายการ", value: input.transactionTime },
      { id: "note", label: "หมายเหตุเพิ่มเติม", value: input.note },
      { id: "status", label: "status", value: input.status },
    ],
  };
  await appendSupportSubmission("deposit_issue", record);
};

const writeWithdrawToLocalDev = async (input: WithdrawIssueSubmission): Promise<void> => {
  const record: SupportSubmissionRecord = {
    id: crypto.randomUUID(),
    kind: "withdraw_issue",
    slug: input.metadata.slug,
    linkId: input.metadata.linkId,
    formTitle: input.metadata.formTitle,
    template: input.metadata.template,
    submittedAt: input.submittedAt,
    fields: [
      { id: "user", label: "USER", value: input.user },
      { id: "phone", label: "เบอร์โทรศัพท์", value: input.phone },
      { id: "full_name", label: "ชื่อ-นามสกุล", value: input.fullName },
      { id: "bank_account", label: "เลขที่บัญชี", value: input.bankAccount },
      { id: "transaction_time", label: "เวลาที่ทำรายการ", value: input.transactionTime },
      { id: "note", label: "หมายเหตุเพิ่มเติม", value: input.note },
      { id: "status", label: "status", value: input.status },
    ],
  };
  await appendSupportSubmission("withdraw_issue", record);
};

const writeDepositToGoogleSheets = async (input: DepositIssueSubmission): Promise<void> => {
  const google = getGoogleConfig();
  await appendGoogleSheetRow(google.depositTab, [
    input.submittedAt,
    input.issueType,
    input.user,
    input.registeredPhone,
    input.fullName,
    input.slipUrl,
    input.transactionTime,
    input.note,
    input.status,
  ]);
};

const writeWithdrawToGoogleSheets = async (input: WithdrawIssueSubmission): Promise<void> => {
  const google = getGoogleConfig();
  await appendGoogleSheetRow(google.withdrawTab, [
    input.submittedAt,
    input.issueType,
    input.user,
    input.phone,
    input.fullName,
    input.bankAccount,
    input.transactionTime,
    input.note,
    input.status,
  ]);
};

const withFallback = async (fn: () => Promise<void>, fallback: () => Promise<void>) => {
  try {
    await fn();
  } catch (error) {
    if (!isDevelopment) {
      throw error;
    }
    console.error("[support-submission] Primary adapter failed, falling back to local_dev.", error);
    await fallback();
  }
};

export const submitDepositIssue = async (params: {
  slug: string;
  linkId: string;
  formTitle: string;
  template: string;
  submittedAt?: string;
  fields: SupportSubmissionRecord["fields"];
  slipUrl: string;
}) => {
  console.info("[support-submission] deposit_issue parsed payload", {
    slug: params.slug,
    linkId: params.linkId,
    formTitle: params.formTitle,
    template: params.template,
    fieldsCount: params.fields.length,
    fieldIds: params.fields.map((field) => field.id),
  });
  const submittedAt = params.submittedAt ?? new Date().toISOString();
  const input: DepositIssueSubmission = {
    submittedAt,
    issueType: "ฝากเงินไม่เข้า",
    user: getField(params.fields, ["USER"]),
    registeredPhone: getField(params.fields, ["เบอร์โทรศัพท์ที่ลงทะเบียน"]),
    fullName: getField(params.fields, ["ชื่อ-นามสกุล"]),
    slipUrl: params.slipUrl,
    transactionTime: getField(params.fields, ["เวลาที่ทำรายการ"]),
    note: getField(params.fields, ["หมายเหตุเพิ่มเติม"]),
    status: DEFAULT_STATUS,
    metadata: {
      slug: params.slug,
      linkId: params.linkId,
      formTitle: params.formTitle,
      template: params.template,
    },
  };
  console.info("[support-submission] deposit_issue normalized payload", {
    submittedAt: input.submittedAt,
    issueType: input.issueType,
    user: input.user,
    registeredPhone: input.registeredPhone,
    fullName: input.fullName,
    transactionTime: input.transactionTime,
    note: input.note,
    status: input.status,
    metadata: input.metadata,
  });

  const mode = resolveEffectiveMode();
  const google = getGoogleConfig();
  console.info("[support-submission] deposit_issue adapter mode", {
    mode,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    spreadsheetId: google.spreadsheetId,
    depositTab: google.depositTab,
    googleConfigured: google.configured,
  });
  if (mode === "local_dev") {
    await writeDepositToLocalDev(input);
    return;
  }
  await withFallback(() => writeDepositToGoogleSheets(input), () => writeDepositToLocalDev(input));
};

export const submitWithdrawIssue = async (params: {
  slug: string;
  linkId: string;
  formTitle: string;
  template: string;
  submittedAt?: string;
  fields: SupportSubmissionRecord["fields"];
}) => {
  const submittedAt = params.submittedAt ?? new Date().toISOString();
  const input: WithdrawIssueSubmission = {
    submittedAt,
    issueType: "ถอนเงินไม่ได้",
    user: getField(params.fields, ["USER"]),
    phone: getField(params.fields, ["เบอร์โทรศัพท์"]),
    fullName: getField(params.fields, ["ชื่อ-นามสกุล"]),
    bankAccount: getField(params.fields, ["เลขที่บัญชี"]),
    transactionTime: getField(params.fields, ["เวลาที่ทำรายการ"]),
    note: getField(params.fields, ["หมายเหตุเพิ่มเติม"]),
    status: DEFAULT_STATUS,
    metadata: {
      slug: params.slug,
      linkId: params.linkId,
      formTitle: params.formTitle,
      template: params.template,
    },
  };

  const mode = resolveEffectiveMode();
  if (mode === "local_dev") {
    await writeWithdrawToLocalDev(input);
    return;
  }
  await withFallback(() => writeWithdrawToGoogleSheets(input), () => writeWithdrawToLocalDev(input));
};
