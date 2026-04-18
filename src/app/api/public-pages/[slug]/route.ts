import { NextResponse } from "next/server";

import { builderDataSchema } from "@/features/builder/schema";
import { BuilderData } from "@/features/builder/types";
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const candidate = (payload as { data?: unknown })?.data;
  const parsed = builderDataSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
  }

  try {
    await upsertPublicPage(slug, parsed.data as BuilderData);
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
