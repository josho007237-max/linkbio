import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

type RouteParams = {
  kind: string;
  file: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> },
) {
  const { kind, file } = await context.params;
  const normalizedKind = (kind ?? "").trim().toLowerCase();
  if (normalizedKind !== "deposit_issue" && normalizedKind !== "withdraw_issue") {
    return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
  }

  const decodedFile = decodeURIComponent(file ?? "");
  if (!decodedFile || decodedFile.includes("/") || decodedFile.includes("\\") || decodedFile.includes("..")) {
    return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  }

  const absolutePath = path.join(
    process.cwd(),
    "data",
    "support-uploads",
    normalizedKind,
    decodedFile,
  );

  try {
    const buffer = await readFile(absolutePath);
    const ext = path.extname(decodedFile).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }
}
