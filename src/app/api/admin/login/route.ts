import { NextResponse } from "next/server";

import {
  createAdminSessionCookie,
  isAdminPasswordValid,
} from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let password = "";

    if (contentType.includes("application/json")) {
      const payload = (await request.json()) as { password?: unknown };
      password =
        typeof payload?.password === "string" ? payload.password.trim() : "";
    } else {
      const formData = await request.formData();
      const raw = formData.get("password");
      password = typeof raw === "string" ? raw.trim() : "";
    }

    if (!isAdminPasswordValid(password)) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(createAdminSessionCookie());
    return response;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
