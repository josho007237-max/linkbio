import { NextResponse } from "next/server";

import {
  SupportSubmissionRecord,
} from "@/lib/server/support-submissions-store";
import { submitWithdrawIssue } from "@/lib/server/support-submission-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WithdrawPayload = {
  slug?: unknown;
  linkId?: unknown;
  template?: unknown;
  formTitle?: unknown;
  responses?: unknown;
  bankName?: unknown;
  accountNumber?: unknown;
  amount?: unknown;
};

const normalizeResponses = (raw: unknown): SupportSubmissionRecord["fields"] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as {
        id?: unknown;
        label?: unknown;
        value?: unknown;
      };
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string") {
        return null;
      }
      const value =
        typeof candidate.value === "string"
          ? candidate.value
          : Array.isArray(candidate.value)
            ? candidate.value.filter((entry): entry is string => typeof entry === "string")
            : "";
      return {
        id: candidate.id,
        label: candidate.label,
        value,
      };
    })
    .filter((entry): entry is SupportSubmissionRecord["fields"][number] => Boolean(entry));
};

const normalizeAmount = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return trimmed;
  }
  return Number(normalized).toFixed(2);
};

const upsertField = (
  fields: SupportSubmissionRecord["fields"],
  id: string,
  label: string,
  value: string,
): SupportSubmissionRecord["fields"] => {
  if (!value) {
    return fields;
  }
  const next = [...fields];
  const index = next.findIndex(
    (item) => item.id.trim().toLowerCase() === id.trim().toLowerCase() || item.label.trim() === label,
  );
  const entry = { id, label, value };
  if (index >= 0) {
    next[index] = entry;
  } else {
    next.push(entry);
  }
  return next;
};

export async function POST(request: Request) {
  let payload: WithdrawPayload;
  try {
    payload = (await request.json()) as WithdrawPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const linkId = typeof payload.linkId === "string" ? payload.linkId.trim() : "";
  const template = typeof payload.template === "string" ? payload.template.trim() : "";
  const formTitle = typeof payload.formTitle === "string" ? payload.formTitle.trim() : "";
  const responses = normalizeResponses(payload.responses);
  const bankName = typeof payload.bankName === "string" ? payload.bankName.trim() : "";
  const accountNumber = typeof payload.accountNumber === "string" ? payload.accountNumber.trim() : "";
  const amount = normalizeAmount(typeof payload.amount === "string" ? payload.amount : "");
  const withBankName = upsertField(responses, "bank_name", "bank_name", bankName);
  const withAccountNumber = upsertField(withBankName, "account_number", "account_number", accountNumber);
  const mergedResponses = upsertField(withAccountNumber, "amount", "amount", amount);

  if (!slug || !linkId || !formTitle || template !== "withdraw_issue") {
    return NextResponse.json({ error: "Missing required metadata." }, { status: 400 });
  }

  try {
    const result = await submitWithdrawIssue({
      slug,
      linkId,
      formTitle,
      template,
      submittedAt: new Date().toISOString(),
      fields: mergedResponses,
    });
    return NextResponse.json({ id: crypto.randomUUID(), ...result });
  } catch (error) {
    console.error("[support-submission] withdraw_issue submission failed", error);
    return NextResponse.json(
      { error: "Submission failed. Please try again later." },
      { status: 500 },
    );
  }
}
