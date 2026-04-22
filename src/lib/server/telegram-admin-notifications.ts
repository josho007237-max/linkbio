import "server-only";

type TelegramSupportAlert = {
  issueType: "deposit_issue" | "withdraw_issue";
  submittedAt: string;
  user: string;
  registeredPhone: string;
  transactionTime: string;
  note: string;
  slug: string;
  bankName?: string;
  accountNumber?: string;
  amount?: string;
  caseId?: string | null;
  repeatCount?: number;
  isDuplicate?: boolean;
  duplicateOf?: string | null;
  priority?: "normal" | "urgent";
  sheetTab?: string;
  sheetRow?: number | null;
  updatedRange?: string | null;
  urgent?: boolean;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";

const getTelegramAdminConfig = () => {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim();

  return {
    botToken,
    adminChatId,
    configured: Boolean(botToken && adminChatId),
  };
};

const toLine = (label: string, value: string | number | boolean | null | undefined): string =>
  `${label}: ${value === null || value === undefined || value === "" ? "-" : String(value)}`;

const buildTelegramSupportMessage = (payload: TelegramSupportAlert): string => {
  const heading = payload.urgent
    ? "URGENT support case repeat alert"
    : "New support case";
  return [
    heading,
    toLine("issue_type", payload.issueType),
    toLine("submitted_at", payload.submittedAt),
    toLine("user", payload.user),
    toLine("registered_phone", payload.registeredPhone),
    toLine("bank_name", payload.bankName),
    toLine("account_number", payload.accountNumber),
    toLine("amount", payload.amount),
    toLine("transaction_time", payload.transactionTime),
    toLine("note", payload.note),
    toLine("slug", payload.slug),
    toLine("case_id", payload.caseId),
    toLine("repeat_count", payload.repeatCount),
    toLine("is_duplicate", payload.isDuplicate),
    toLine("duplicate_of", payload.duplicateOf),
    toLine("priority", payload.priority),
    toLine("sheet_tab", payload.sheetTab),
    toLine("sheet_row", payload.sheetRow),
    toLine("sheet_range", payload.updatedRange),
  ].join("\n");
};

export const sendTelegramSupportIssueAlert = async (
  payload: TelegramSupportAlert,
): Promise<void> => {
  const config = getTelegramAdminConfig();
  if (!config.configured) {
    console.warn("[support-submission] Telegram alert skipped: missing config");
    return;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: config.adminChatId,
      text: buildTelegramSupportMessage(payload),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
};
