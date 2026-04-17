import { NextResponse } from "next/server";

import {
  appendSupportSubmission,
  SupportSubmissionRecord,
} from "@/lib/server/support-submissions-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WithdrawPayload = {
  slug?: unknown;
  linkId?: unknown;
  template?: unknown;
  formTitle?: unknown;
  responses?: unknown;
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

  if (!slug || !linkId || !formTitle || template !== "withdraw_issue") {
    return NextResponse.json({ error: "Missing required metadata." }, { status: 400 });
  }

  const record: SupportSubmissionRecord = {
    id: crypto.randomUUID(),
    kind: "withdraw_issue",
    slug,
    linkId,
    formTitle,
    template,
    submittedAt: new Date().toISOString(),
    fields: responses,
  };

  await appendSupportSubmission("withdraw_issue", record);
  return NextResponse.json({ ok: true, id: record.id });
}
