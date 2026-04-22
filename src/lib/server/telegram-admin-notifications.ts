import "server-only";

export type TelegramSupportIssueAlert = {
  issueType: string;
  submittedAt: string;
  user: string;
  registeredPhone: string;
  transactionTime: string;
  note: string;
  slug: string;
  sheetTab: string;
  sheetRow: number | null;
  updatedRange: string | null;
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

const formatValue = (value: string | number | null): string => {
  if (value === null || value === "") {
    return "-";
  }
  return String(value);
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
};

const buildTelegramSupportIssueMessage = (alert: TelegramSupportIssueAlert): string =>
  [
    "New support case",
    `issue_type: ${formatValue(alert.issueType)}`,
    `submitted_at: ${formatValue(alert.submittedAt)}`,
    `user: ${formatValue(alert.user)}`,
    `registered_phone: ${formatValue(alert.registeredPhone)}`,
    `transaction_time: ${formatValue(alert.transactionTime)}`,
    `note: ${formatValue(truncate(alert.note, 900))}`,
    `slug: ${formatValue(alert.slug)}`,
    `sheet_tab: ${formatValue(alert.sheetTab)}`,
    `sheet_row: ${formatValue(alert.sheetRow)}`,
    `sheet_range: ${formatValue(alert.updatedRange)}`,
  ].join("\n");

export const sendTelegramSupportIssueAlert = async (
  alert: TelegramSupportIssueAlert,
): Promise<void> => {
  const config = getTelegramAdminConfig();
  if (!config.configured) {
    console.warn("[support-submission] Telegram admin alert skipped: config missing.");
    return;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: config.adminChatId,
      text: buildTelegramSupportIssueMessage(alert),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram admin alert failed (${response.status}): ${body}`);
  }
};
