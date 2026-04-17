import { NextResponse } from "next/server";

import { builderDataSchema } from "@/features/builder/schema";
import { BuilderData } from "@/features/builder/types";
import {
  getDevPublicPageBySlug,
  removeDevPublicPageBySlug,
  upsertDevPublicPage,
} from "@/lib/server/dev-public-pages-store";

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

  const data = await getDevPublicPageBySlug(slug);
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

  await upsertDevPublicPage(slug, parsed.data as BuilderData);
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

  await removeDevPublicPageBySlug(slug);
  return NextResponse.json({ ok: true });
}
