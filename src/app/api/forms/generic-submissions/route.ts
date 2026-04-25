import { NextResponse } from "next/server";

import { submitGenericFormSubmission } from "@/lib/server/generic-form-submission-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenericFormPayload = {
  slug?: unknown;
  form_title?: unknown;
  form_id?: unknown;
  submitted_at?: unknown;
  responses?: unknown;
};

type GenericFormResponseField = {
  id: string;
  label: string;
  value: string | string[];
};

const normalizeResponses = (raw: unknown): GenericFormResponseField[] => {
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
        id: candidate.id.trim(),
        label: candidate.label.trim(),
        value,
      };
    })
    .filter((entry): entry is GenericFormResponseField => Boolean(entry));
};

const asNonEmptyString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeSubmittedAt = (value: unknown): string => {
  const candidate = asNonEmptyString(value);
  if (!candidate) {
    return new Date().toISOString();
  }
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

export async function POST(request: Request) {
  let payload: GenericFormPayload;
  try {
    payload = (await request.json()) as GenericFormPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const slug = asNonEmptyString(payload.slug);
  const formTitle = asNonEmptyString(payload.form_title);
  const formId = asNonEmptyString(payload.form_id);
  const submittedAt = normalizeSubmittedAt(payload.submitted_at);
  const responses = normalizeResponses(payload.responses);

  if (!slug || !formTitle || !formId) {
    return NextResponse.json({ error: "Missing required metadata." }, { status: 400 });
  }
  if (responses.length === 0) {
    return NextResponse.json({ error: "Missing form responses." }, { status: 400 });
  }

  console.info("[generic-form-submission] parsed payload", {
    slug,
    formTitle,
    formId,
    submittedAt,
    responseFieldCount: responses.length,
  });

  try {
    const result = await submitGenericFormSubmission({
      submittedAt,
      slug,
      formTitle,
      formId,
      responses,
    });
    console.info("[generic-form-submission] submit result", result);
    return NextResponse.json({
      id: crypto.randomUUID(),
      ...result,
    });
  } catch (error) {
    console.error("[generic-form-submission] submit failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submission failed. Please try again later." },
      { status: 500 },
    );
  }
}

