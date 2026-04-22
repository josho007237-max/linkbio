import { createSign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { appendSupportSubmission, SupportSubmissionRecord } from "@/lib/server/support-submissions-store";
import { sendTelegramSupportIssueAlert } from "@/lib/server/telegram-admin-notifications";

export type SupportSubmissionAdapterMode = "auto" | "local_dev" | "google_sheets";
type SupportIssueType = "deposit_issue" | "withdraw_issue";
type SupportPriority = "normal" | "urgent";

type SupportCaseDecision = {
  caseId: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  repeatCount: number;
  priority: SupportPriority;
  message: string;
  existingCaseId: string | null;
};

export type SupportSubmissionResult = {
  ok: true;
  caseId: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  repeatCount: number;
  priority: SupportPriority;
  message: string;
  existingCaseId: string | null;
};

type GoogleSheetAppendResult = {
  tabName: string;
  updatedRange: string | null;
  updatedRows: number | null;
  rowNumber: number | null;
};

type DepositIssueSubmission = {
  submittedAt: string;
  issueType: SupportIssueType;
  user: string;
  registeredPhone: string;
  bankName: string;
  accountNumber: string;
  amount: string;
  slipUrl: string;
  transactionTime: string;
  note: string;
  status: string;
  caseId: string;
  repeatCount: number;
  isDuplicate: boolean;
  duplicateOf: string | null;
  priority: SupportPriority;
  metadata: {
    slug: string;
    linkId: string;
    formTitle: string;
    template: string;
  };
};

type WithdrawIssueSubmission = {
  submittedAt: string;
  issueType: SupportIssueType;
  user: string;
  registeredPhone: string;
  fullName: string;
  bankName: string;
  accountNumber: string;
  amount: string;
  transactionTime: string;
  note: string;
  status: string;
  caseId: string;
  repeatCount: number;
  isDuplicate: boolean;
  duplicateOf: string | null;
  priority: SupportPriority;
  metadata: {
    slug: string;
    linkId: string;
    formTitle: string;
    template: string;
  };
};

type SupportCaseLogEntry = {
  issueType: SupportIssueType;
  user: string;
  registeredPhone: string;
  identityKey: string;
  caseId: string;
  submittedAt: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  repeatCount: number;
  priority: SupportPriority;
};

const DEFAULT_STATUS = "new";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const SUPPORT_CASE_LOG_FILE = path.join(process.cwd(), "data", "support-case-log.json");

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
  throw new Error("Google Sheets adapter config is missing in production.");
};

const normalizeIdentityPart = (value: string): string => value.trim().toLowerCase();

const normalizePhone = (value: string): string =>
  value.replace(/[^\d+]/g, "").trim().toLowerCase();

const toIdentityKey = (issueType: SupportIssueType, user: string, registeredPhone: string): string =>
  `${issueType}::${normalizeIdentityPart(user)}::${normalizePhone(registeredPhone)}`;

const getDatePart = (date: Date): string => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const getCasePrefix = (issueType: SupportIssueType): "DEP" | "WDR" =>
  issueType === "deposit_issue" ? "DEP" : "WDR";

const parseCaseSequence = (caseId: string): number | null => {
  const match = caseId.match(/-(\d{4})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const readSupportCaseLog = async (): Promise<SupportCaseLogEntry[]> => {
  try {
    const raw = await readFile(SUPPORT_CASE_LOG_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is SupportCaseLogEntry =>
        Boolean(entry && typeof entry === "object" && typeof (entry as SupportCaseLogEntry).caseId === "string"),
    );
  } catch {
    return [];
  }
};

const writeSupportCaseLog = async (entries: SupportCaseLogEntry[]): Promise<void> => {
  await mkdir(path.dirname(SUPPORT_CASE_LOG_FILE), { recursive: true });
  await writeFile(SUPPORT_CASE_LOG_FILE, JSON.stringify(entries, null, 2), "utf8");
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

const getUpdatedRangeRowNumber = (updatedRange: string | null): number | null => {
  const match = updatedRange?.match(/![A-Z]+(\d+)(?::|$)/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const getSheetIdByTabName = async (
  spreadsheetId: string,
  tabName: string,
  token: string,
): Promise<number> => {
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets metadata fetch failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const matched = payload.sheets?.find(
    (sheet) => sheet.properties?.title?.trim() === tabName,
  );
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

const getField = (
  fields: SupportSubmissionRecord["fields"],
  labels: string[],
): string => {
  const normalizedLabels = labels.map((label) => label.trim().toLowerCase());
  const matched = fields.find((field) =>
    normalizedLabels.includes(field.label.trim().toLowerCase()) ||
    normalizedLabels.includes(field.id.trim().toLowerCase()),
  );
  if (!matched) {
    return "";
  }
  return Array.isArray(matched.value) ? matched.value.join(", ") : String(matched.value ?? "");
};

const getNextCaseId = (
  issueType: SupportIssueType,
  now: Date,
  logEntries: SupportCaseLogEntry[],
): string => {
  const prefix = getCasePrefix(issueType);
  const datePart = getDatePart(now);
  const prefixWithDate = `${prefix}-${datePart}-`;
  const maxSequence = logEntries
    .map((entry) => entry.caseId)
    .filter((caseId) => caseId.startsWith(prefixWithDate))
    .map((caseId) => parseCaseSequence(caseId))
    .reduce<number>((max, value) => (typeof value === "number" && value > max ? value : max), 0);
  const nextSequence = String(maxSequence + 1).padStart(4, "0");
  return `${prefix}-${datePart}-${nextSequence}`;
};

const decideCaseSubmission = (
  issueType: SupportIssueType,
  user: string,
  registeredPhone: string,
  submittedAt: string,
  logEntries: SupportCaseLogEntry[],
): SupportCaseDecision => {
  const identityKey = toIdentityKey(issueType, user, registeredPhone);
  const submittedMs = new Date(submittedAt).getTime();
  const recentMatches = logEntries.filter((entry) => {
    if (entry.identityKey !== identityKey) {
      return false;
    }
    const entryMs = new Date(entry.submittedAt).getTime();
    if (!Number.isFinite(entryMs)) {
      return false;
    }
    return submittedMs - entryMs <= DUPLICATE_WINDOW_MS;
  });

  const repeatCount = recentMatches.length + 1;
  const existingCase = recentMatches.find((entry) => !entry.isDuplicate) ?? recentMatches[0] ?? null;
  const existingCaseId = existingCase?.caseId ?? null;
  const isDuplicate = Boolean(existingCaseId);
  const duplicateOf = isDuplicate ? existingCaseId : null;
  const priority: SupportPriority = repeatCount > 2 ? "urgent" : "normal";

  if (isDuplicate) {
    return {
      caseId: existingCaseId ?? "",
      isDuplicate: true,
      duplicateOf,
      repeatCount,
      priority,
      message: "Existing case already received.",
      existingCaseId,
    };
  }

  const caseId = getNextCaseId(issueType, new Date(submittedAt), logEntries);
  return {
    caseId,
    isDuplicate: false,
    duplicateOf: null,
    repeatCount,
    priority,
    message: "Case received.",
    existingCaseId: null,
  };
};

const appendCaseLog = async (entry: SupportCaseLogEntry): Promise<void> => {
  const current = await readSupportCaseLog();
  current.push(entry);
  await writeSupportCaseLog(current);
};

const writeDepositToLocalDev = async (input: DepositIssueSubmission): Promise<void> => {
  const record: SupportSubmissionRecord = {
    id: input.caseId,
    kind: "deposit_issue",
    slug: input.metadata.slug,
    linkId: input.metadata.linkId,
    formTitle: input.metadata.formTitle,
    template: input.metadata.template,
    submittedAt: input.submittedAt,
    fields: [
      { id: "case_id", label: "case_id", value: input.caseId },
      { id: "user", label: "USER", value: input.user },
      { id: "registered_phone", label: "registered_phone", value: input.registeredPhone },
      { id: "bank_name", label: "bank_name", value: input.bankName },
      { id: "account_number", label: "account_number", value: input.accountNumber },
      { id: "amount", label: "amount", value: input.amount },
      { id: "slip_url", label: "slip_url", value: input.slipUrl },
      { id: "transaction_time", label: "transaction_time", value: input.transactionTime },
      { id: "note", label: "note", value: input.note },
      { id: "repeat_count", label: "repeat_count", value: String(input.repeatCount) },
      { id: "is_duplicate", label: "is_duplicate", value: String(input.isDuplicate) },
      { id: "duplicate_of", label: "duplicate_of", value: input.duplicateOf ?? "" },
      { id: "priority", label: "priority", value: input.priority },
      { id: "status", label: "status", value: input.status },
    ],
  };
  await appendSupportSubmission("deposit_issue", record);
};

const writeWithdrawToLocalDev = async (input: WithdrawIssueSubmission): Promise<void> => {
  const record: SupportSubmissionRecord = {
    id: input.caseId,
    kind: "withdraw_issue",
    slug: input.metadata.slug,
    linkId: input.metadata.linkId,
    formTitle: input.metadata.formTitle,
    template: input.metadata.template,
    submittedAt: input.submittedAt,
    fields: [
      { id: "case_id", label: "case_id", value: input.caseId },
      { id: "user", label: "USER", value: input.user },
      { id: "registered_phone", label: "registered_phone", value: input.registeredPhone },
      { id: "full_name", label: "full_name", value: input.fullName },
      { id: "bank_name", label: "bank_name", value: input.bankName },
      { id: "account_number", label: "account_number", value: input.accountNumber },
      { id: "amount", label: "amount", value: input.amount },
      { id: "transaction_time", label: "transaction_time", value: input.transactionTime },
      { id: "note", label: "note", value: input.note },
      { id: "repeat_count", label: "repeat_count", value: String(input.repeatCount) },
      { id: "is_duplicate", label: "is_duplicate", value: String(input.isDuplicate) },
      { id: "duplicate_of", label: "duplicate_of", value: input.duplicateOf ?? "" },
      { id: "priority", label: "priority", value: input.priority },
      { id: "status", label: "status", value: input.status },
    ],
  };
  await appendSupportSubmission("withdraw_issue", record);
};

const writeDepositToGoogleSheets = async (
  input: DepositIssueSubmission,
): Promise<GoogleSheetAppendResult> => {
  const google = getGoogleConfig();
  return appendGoogleSheetRow(google.depositTab, [
    input.submittedAt,
    input.issueType,
    input.user,
    input.registeredPhone,
    input.bankName,
    input.accountNumber,
    input.amount,
    input.slipUrl,
    input.transactionTime,
    input.note,
    input.metadata.slug,
    input.caseId,
    String(input.repeatCount),
    String(input.isDuplicate),
    input.duplicateOf ?? "",
    input.priority,
    input.status,
  ]);
};

const writeWithdrawToGoogleSheets = async (
  input: WithdrawIssueSubmission,
): Promise<GoogleSheetAppendResult> => {
  const google = getGoogleConfig();
  return appendGoogleSheetRow(google.withdrawTab, [
    input.submittedAt,
    input.issueType,
    input.user,
    input.registeredPhone,
    input.fullName,
    input.bankName,
    input.accountNumber,
    input.amount,
    input.transactionTime,
    input.note,
    input.metadata.slug,
    input.caseId,
    String(input.repeatCount),
    String(input.isDuplicate),
    input.duplicateOf ?? "",
    input.priority,
    input.status,
  ]);
};

const withFallback = async <T>(fn: () => Promise<T>, fallback: () => Promise<T>) => {
  try {
    return await fn();
  } catch (error) {
    if (!isDevelopment) {
      throw error;
    }
    console.error("[support-submission] Primary adapter failed, falling back to local_dev.", error);
    return fallback();
  }
};

const logCaseAttempt = async (
  issueType: SupportIssueType,
  user: string,
  registeredPhone: string,
  decision: SupportCaseDecision,
  submittedAt: string,
): Promise<void> => {
  await appendCaseLog({
    issueType,
    user,
    registeredPhone,
    identityKey: toIdentityKey(issueType, user, registeredPhone),
    caseId: decision.caseId || decision.existingCaseId || "UNKNOWN",
    submittedAt,
    isDuplicate: decision.isDuplicate,
    duplicateOf: decision.duplicateOf,
    repeatCount: decision.repeatCount,
    priority: decision.priority,
  });
};

const maybeSendUrgentDuplicateAlert = async (params: {
  issueType: SupportIssueType;
  submittedAt: string;
  user: string;
  registeredPhone: string;
  bankName: string;
  accountNumber: string;
  amount: string;
  transactionTime: string;
  note: string;
  slug: string;
  decision: SupportCaseDecision;
}) => {
  if (!params.decision.isDuplicate || params.decision.repeatCount <= 2) {
    return;
  }
  try {
    await sendTelegramSupportIssueAlert({
      issueType: params.issueType,
      submittedAt: params.submittedAt,
      user: params.user,
      registeredPhone: params.registeredPhone,
      bankName: params.bankName,
      accountNumber: params.accountNumber,
      amount: params.amount,
      transactionTime: params.transactionTime,
      note: params.note,
      slug: params.slug,
      caseId: params.decision.existingCaseId ?? params.decision.caseId,
      repeatCount: params.decision.repeatCount,
      isDuplicate: true,
      duplicateOf: params.decision.duplicateOf,
      priority: "urgent",
      urgent: true,
    });
  } catch (error) {
    console.error("[support-submission] Telegram urgent duplicate alert failed", error);
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
}): Promise<SupportSubmissionResult> => {
  const submittedAt = params.submittedAt ?? new Date().toISOString();
  const user = getField(params.fields, ["USER", "user", "username"]);
  const registeredPhone = getField(params.fields, [
    "เบอร์โทรศัพท์ที่ลงทะเบียน",
    "registered_phone",
    "เบอร์โทรศัพท์",
  ]);
  const bankName = getField(params.fields, ["bank_name", "ชื่อธนาคาร", "bankname"]);
  const accountNumber = getField(params.fields, ["account_number", "เลขที่บัญชี", "accountnumber"]);
  const amount = getField(params.fields, ["amount", "ยอดเงิน"]);
  const transactionTime = getField(params.fields, ["เวลาที่ทำรายการ", "transaction_time"]);
  const note = getField(params.fields, ["หมายเหตุเพิ่มเติม", "note"]);

  const logEntries = await readSupportCaseLog();
  const decision = decideCaseSubmission("deposit_issue", user, registeredPhone, submittedAt, logEntries);

  await logCaseAttempt("deposit_issue", user, registeredPhone, decision, submittedAt);

  if (decision.isDuplicate) {
    await maybeSendUrgentDuplicateAlert({
      issueType: "deposit_issue",
      submittedAt,
      user,
      registeredPhone,
      bankName,
      accountNumber,
      amount,
      transactionTime,
      note,
      slug: params.slug,
      decision,
    });
    return {
      ok: true,
      caseId: decision.existingCaseId ?? decision.caseId,
      isDuplicate: true,
      duplicateOf: decision.duplicateOf,
      repeatCount: decision.repeatCount,
      priority: decision.priority,
      message: "Existing case already received.",
      existingCaseId: decision.existingCaseId,
    };
  }

  const input: DepositIssueSubmission = {
    submittedAt,
    issueType: "deposit_issue",
    user,
    registeredPhone,
    bankName,
    accountNumber,
    amount,
    slipUrl: params.slipUrl,
    transactionTime,
    note,
    status: DEFAULT_STATUS,
    caseId: decision.caseId,
    repeatCount: decision.repeatCount,
    isDuplicate: false,
    duplicateOf: null,
    priority: decision.priority,
    metadata: {
      slug: params.slug,
      linkId: params.linkId,
      formTitle: params.formTitle,
      template: params.template,
    },
  };

  const mode = resolveEffectiveMode();
  if (mode === "local_dev") {
    await writeDepositToLocalDev(input);
    return {
      ok: true,
      caseId: input.caseId,
      isDuplicate: false,
      duplicateOf: null,
      repeatCount: input.repeatCount,
      priority: input.priority,
      message: "Case received.",
      existingCaseId: null,
    };
  }

  const appendResult = await withFallback(
    () => writeDepositToGoogleSheets(input),
    async () => {
      await writeDepositToLocalDev(input);
      return {
        tabName: "",
        updatedRange: null,
        updatedRows: null,
        rowNumber: null,
      };
    },
  );

  if (appendResult.tabName) {
    try {
      await sendTelegramSupportIssueAlert({
        issueType: "deposit_issue",
        submittedAt: input.submittedAt,
        user: input.user,
        registeredPhone: input.registeredPhone,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        amount: input.amount,
        transactionTime: input.transactionTime,
        note: input.note,
        slug: input.metadata.slug,
        caseId: input.caseId,
        repeatCount: input.repeatCount,
        isDuplicate: input.isDuplicate,
        duplicateOf: input.duplicateOf,
        priority: input.priority,
        sheetTab: appendResult.tabName,
        sheetRow: appendResult.rowNumber,
        updatedRange: appendResult.updatedRange,
      });
    } catch (error) {
      console.error("[support-submission] Telegram deposit alert failed", error);
    }
  }

  return {
    ok: true,
    caseId: input.caseId,
    isDuplicate: false,
    duplicateOf: null,
    repeatCount: input.repeatCount,
    priority: input.priority,
    message: "Case received.",
    existingCaseId: null,
  };
};

export const submitWithdrawIssue = async (params: {
  slug: string;
  linkId: string;
  formTitle: string;
  template: string;
  submittedAt?: string;
  fields: SupportSubmissionRecord["fields"];
}): Promise<SupportSubmissionResult> => {
  const submittedAt = params.submittedAt ?? new Date().toISOString();
  const user = getField(params.fields, ["USER", "user", "username"]);
  const registeredPhone = getField(params.fields, [
    "เบอร์โทรศัพท์ที่ลงทะเบียน",
    "เบอร์โทรศัพท์",
    "registered_phone",
  ]);
  const fullName = getField(params.fields, ["ชื่อ-นามสกุล", "full_name"]);
  const bankName = getField(params.fields, ["bank_name", "ชื่อธนาคาร", "bankname"]);
  const accountNumber = getField(params.fields, ["account_number", "เลขที่บัญชี", "bank_account"]);
  const amount = getField(params.fields, ["amount", "ยอดเงิน"]);
  const transactionTime = getField(params.fields, ["เวลาที่ทำรายการ", "transaction_time"]);
  const note = getField(params.fields, ["หมายเหตุเพิ่มเติม", "note"]);

  const logEntries = await readSupportCaseLog();
  const decision = decideCaseSubmission("withdraw_issue", user, registeredPhone, submittedAt, logEntries);

  await logCaseAttempt("withdraw_issue", user, registeredPhone, decision, submittedAt);

  if (decision.isDuplicate) {
    await maybeSendUrgentDuplicateAlert({
      issueType: "withdraw_issue",
      submittedAt,
      user,
      registeredPhone,
      bankName,
      accountNumber,
      amount,
      transactionTime,
      note,
      slug: params.slug,
      decision,
    });
    return {
      ok: true,
      caseId: decision.existingCaseId ?? decision.caseId,
      isDuplicate: true,
      duplicateOf: decision.duplicateOf,
      repeatCount: decision.repeatCount,
      priority: decision.priority,
      message: "Existing case already received.",
      existingCaseId: decision.existingCaseId,
    };
  }

  const input: WithdrawIssueSubmission = {
    submittedAt,
    issueType: "withdraw_issue",
    user,
    registeredPhone,
    fullName,
    bankName,
    accountNumber,
    amount,
    transactionTime,
    note,
    status: DEFAULT_STATUS,
    caseId: decision.caseId,
    repeatCount: decision.repeatCount,
    isDuplicate: false,
    duplicateOf: null,
    priority: decision.priority,
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
    return {
      ok: true,
      caseId: input.caseId,
      isDuplicate: false,
      duplicateOf: null,
      repeatCount: input.repeatCount,
      priority: input.priority,
      message: "Case received.",
      existingCaseId: null,
    };
  }

  const appendResult = await withFallback(
    () => writeWithdrawToGoogleSheets(input),
    async () => {
      await writeWithdrawToLocalDev(input);
      return {
        tabName: "",
        updatedRange: null,
        updatedRows: null,
        rowNumber: null,
      };
    },
  );

  if (appendResult.tabName) {
    try {
      await sendTelegramSupportIssueAlert({
        issueType: "withdraw_issue",
        submittedAt: input.submittedAt,
        user: input.user,
        registeredPhone: input.registeredPhone,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        amount: input.amount,
        transactionTime: input.transactionTime,
        note: input.note,
        slug: input.metadata.slug,
        caseId: input.caseId,
        repeatCount: input.repeatCount,
        isDuplicate: input.isDuplicate,
        duplicateOf: input.duplicateOf,
        priority: input.priority,
        sheetTab: appendResult.tabName,
        sheetRow: appendResult.rowNumber,
        updatedRange: appendResult.updatedRange,
      });
    } catch (error) {
      console.error("[support-submission] Telegram withdraw alert failed", error);
    }
  }

  return {
    ok: true,
    caseId: input.caseId,
    isDuplicate: false,
    duplicateOf: null,
    repeatCount: input.repeatCount,
    priority: input.priority,
    message: "Case received.",
    existingCaseId: null,
  };
};
