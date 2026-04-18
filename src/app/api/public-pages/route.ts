import { NextResponse } from "next/server";

import { listPublicPages } from "@/lib/server/public-pages-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pages = await listPublicPages();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[public-pages] LIST failed", error);
    return NextResponse.json({ error: "Failed to list public pages." }, { status: 500 });
  }
}
