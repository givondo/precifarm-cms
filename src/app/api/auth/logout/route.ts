import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/security/session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return NextResponse.json({ data: { ok: true } });
}
