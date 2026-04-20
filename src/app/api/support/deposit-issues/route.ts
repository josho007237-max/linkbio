import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { NextResponse } from "next/server";

import {
  SupportSubmissionRecord,
} from "@/lib/server/support-submissions-store";
import { submitDepositIssue } from "@/lib/server/support-submission-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORT_UPLOADS_PREFIX = "support-uploads";

class SupportUploadConfigError extends Error {
  public readonly publicMessage: string;

  constructor(message: string, publicMessage: string) {
    super(message);
    this.name = "SupportUploadConfigError";
    this.publicMessage = publicMessage;
  }
}

const sanitizeFileName = (fileName: string): string => {
  const parsed = path.parse(fileName || "slip-image");
  const safeBase = (parsed.name || "slip-image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeExt = (parsed.ext || "").replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
};

const sanitizePathSegment = (value: string, fallback: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized || fallback;
};

const getSupabaseStorageConfig = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const bucket = (process.env.SUPPORT_UPLOADS_BUCKET ?? "").trim();

  return {
    url,
    serviceRoleKey,
    bucket,
    hasUrl: Boolean(url),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasBucket: Boolean(bucket),
    isReady: Boolean(url && serviceRoleKey && bucket),
  };
};

const toErrorLog = (error: unknown) => {
  if (error instanceof Error) {
    const maybeStatus = error as Error & { statusCode?: string | number; status?: number };
    return {
      name: error.name,
      message: error.message,
      statusCode: maybeStatus.statusCode,
      status: maybeStatus.status,
    };
  }
  return { raw: error };
};

const uploadSlipToSupabaseStorage = async (params: {
  file: File;
  slug: string;
  linkId: string;
}) => {
  const config = getSupabaseStorageConfig();
  console.info("[support-submission] deposit_issue storage config", {
    bucket: config.bucket,
    hasSupabaseUrl: config.hasUrl,
    hasServiceRoleKey: config.hasServiceRoleKey,
    hasSupportUploadsBucket: config.hasBucket,
    serviceRoleKeyPrefix: config.serviceRoleKey.slice(0, 12),
  });

  if (!config.hasBucket) {
    throw new SupportUploadConfigError(
      "SUPPORT_UPLOADS_BUCKET is missing.",
      "Server misconfiguration: SUPPORT_UPLOADS_BUCKET is not set.",
    );
  }
  if (!config.hasUrl || !config.hasServiceRoleKey) {
    throw new SupportUploadConfigError(
      "Supabase storage env is incomplete for support uploads.",
      "Server misconfiguration: Supabase storage credentials are missing.",
    );
  }

  const client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: bucketData, error: bucketError } = await client.storage.getBucket(config.bucket);
  if (bucketError) {
    console.error("[support-submission] deposit_issue bucket check failed", {
      bucket: config.bucket,
      error: toErrorLog(bucketError),
    });
    throw bucketError;
  }
  console.info("[support-submission] deposit_issue bucket check success", {
    bucket: config.bucket,
    id: bucketData?.id,
    public: bucketData?.public,
  });

  const safeFileName = sanitizeFileName(params.file.name);
  const safeSlug = sanitizePathSegment(params.slug, "unknown-slug");
  const safeLinkId = sanitizePathSegment(params.linkId, "unknown-link");
  const objectPath = [
    SUPPORT_UPLOADS_PREFIX,
    "deposit_issue",
    safeSlug,
    safeLinkId,
    `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`,
  ].join("/");

  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const { data: uploadData, error: uploadError } = await client.storage
    .from(config.bucket)
    .upload(objectPath, fileBuffer, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false,
  });
  console.info("[support-submission] deposit_issue storage upload returned data", uploadData ?? null);
  if (uploadError) {
    console.error("[support-submission] deposit_issue storage upload error", toErrorLog(uploadError));
    throw uploadError;
  }

  const uploadedPath = uploadData?.path || objectPath;
  const { data: publicUrlData } = client.storage.from(config.bucket).getPublicUrl(uploadedPath);
  console.info("[support-submission] deposit_issue computed public URL", {
    path: uploadedPath,
    publicUrl: publicUrlData.publicUrl,
  });
  return publicUrlData.publicUrl;
};

const parseJsonWithFallback = <T>(raw: string | null | undefined, fallback: T): T => {
  if (typeof raw !== "string") {
    return fallback;
  }
  const normalized = raw.trim();
  if (!normalized) {
    return fallback;
  }
  try {
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
};

const parseResponses = (raw: FormDataEntryValue | null): SupportSubmissionRecord["fields"] => {
  if (typeof raw !== "string") {
    return [];
  }
  const parsed = parseJsonWithFallback<unknown>(raw, []);
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
  const runtimeBucket = (process.env.SUPPORT_UPLOADS_BUCKET ?? "").trim();
  console.info("[support-submission] deposit_issue route hit");
  console.info("[support-submission] deposit_issue runtime bucket", {
    bucket: runtimeBucket || null,
    source: runtimeBucket ? "env.SUPPORT_UPLOADS_BUCKET" : "missing",
  });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload." }, { status: 400 });
  }

  console.info("[support-submission] deposit_issue formData keys", Array.from(formData.keys()));

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

  console.info("[support-submission] deposit_issue file metadata", {
    name: slip.name,
    type: slip.type,
    size: slip.size,
  });

  let slipUrl: string;
  try {
    slipUrl = await uploadSlipToSupabaseStorage({
      file: slip,
      slug,
      linkId,
    });
    console.info("[support-submission] deposit_issue storage upload success", {
      fileName: slip.name,
    });
  } catch (error) {
    console.error("[support-submission] deposit_issue storage upload failed", error);
    if (error instanceof SupportUploadConfigError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Image upload failed. Please try again later." },
      { status: 500 },
    );
  }

  console.info("[support-submission] deposit_issue final image URL", slipUrl);
  const submittedAt = new Date().toISOString();

  try {
    await submitDepositIssue({
      slug,
      linkId,
      formTitle,
      template,
      submittedAt,
      fields: responses,
      slipUrl,
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
