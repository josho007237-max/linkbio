import { NextResponse } from "next/server";

import { builderDataSchema } from "@/features/builder/schema";
import { BuilderData } from "@/features/builder/types";
import { normalizeBuilderData } from "@/features/builder/utils";
import {
  getPublicPageBySlug,
  removePublicPageBySlug,
  upsertPublicPage,
} from "@/lib/server/public-pages-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  slug: string;
};

const getSlugFromParams = async (
  params: Promise<RouteParams>,
): Promise<string> => {
  const resolved = await params;
  return (resolved.slug ?? "").trim().toLowerCase();
};

const isDevelopment = process.env.NODE_ENV !== "production";

const getValidationDetails = (error: { issues: Array<{ path: PropertyKey[]; message: string }> }) =>
  error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> },
) {
  const slug = await getSlugFromParams(context.params);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  let data: BuilderData | null;
  try {
    data = await getPublicPageBySlug(slug);
  } catch (error) {
    console.error("[public-pages] GET failed", error);
    return NextResponse.json({ error: "Failed to load public page." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PUT(
  request: Request,
  context: { params: Promise<RouteParams> },
) {
  const slug = await getSlugFromParams(context.params);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!rawBody.trim()) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("[public-pages] PUT invalid JSON", error);
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const candidate = (payload as { data?: unknown })?.data;
  const parsed = builderDataSchema.safeParse(candidate);
  if (!parsed.success) {
    const details = getValidationDetails(parsed.error);
    console.error("[public-pages] PUT invalid profile payload", {
      slug,
      details,
    });
    return NextResponse.json(
      {
        error: "Invalid profile payload.",
        ...(isDevelopment ? { details } : {}),
      },
      { status: 400 },
    );
  }

  try {
    await upsertPublicPage(slug, normalizeBuilderData(parsed.data as BuilderData));
  } catch (error) {
    console.error("[public-pages] PUT failed", error);
    return NextResponse.json({ error: "Failed to save public page." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<RouteParams> },
) {
  const slug = await getSlugFromParams(context.params);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  try {
    await removePublicPageBySlug(slug);
  } catch (error) {
    console.error("[public-pages] DELETE failed", error);
    return NextResponse.json({ error: "Failed to delete public page." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
