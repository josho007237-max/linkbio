import { writeFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import {
  getSupportSubmissionUploadPath,
  SupportSubmissionRecord,
} from "@/lib/server/support-submissions-store";
import { submitDepositIssue } from "@/lib/server/support-submission-adapter";
import { safeJsonParse } from "@/lib/json/safe-json-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const parseResponses = (raw: FormDataEntryValue | null): SupportSubmissionRecord["fields"] => {
  if (typeof raw !== "string") {
    return [];
  }
  const parsed = safeJsonParse<unknown>(raw, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
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
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload." }, { status: 400 });
  }

  const slug = String(formData.get("slug") ?? "").trim();
  const linkId = String(formData.get("linkId") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const formTitle = String(formData.get("formTitle") ?? "").trim();
  const responses = parseResponses(formData.get("responses"));
  const slip = formData.get("slip");

  if (!slug || !linkId || !formTitle || template !== "deposit_issue") {
    return NextResponse.json({ error: "Missing required metadata." }, { status: 400 });
  }

  if (!(slip instanceof File)) {
    return NextResponse.json({ error: "Slip image is required." }, { status: 400 });
  }
  if (!slip.type.startsWith("image/")) {
    return NextResponse.json({ error: "Slip must be an image file." }, { status: 400 });
  }
  if (slip.size <= 0 || slip.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Slip image exceeds the size limit." }, { status: 400 });
  }

  const uploadPath = await getSupportSubmissionUploadPath("deposit_issue", slip.name || "slip-image");
  const fileBuffer = Buffer.from(await slip.arrayBuffer());
  await writeFile(uploadPath.absolutePath, fileBuffer);
  const submittedAt = new Date().toISOString();

  try {
    const origin = new URL(request.url).origin;
    await submitDepositIssue({
      slug,
      linkId,
      formTitle,
      template,
      submittedAt,
      fields: responses,
      slipUrl: `${origin}${uploadPath.apiPath}`,
    });
    return NextResponse.json({ ok: true, id: crypto.randomUUID() });
  } catch (error) {
    console.error("[support-submission] deposit_issue submission failed", error);
    return NextResponse.json(
      { error: "Submission failed. Please try again later." },
      { status: 500 },
    );
  }
}
