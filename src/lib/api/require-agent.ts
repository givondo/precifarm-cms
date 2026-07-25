import { NextResponse } from "next/server";
import { getSessionAgent, type SessionAgent } from "@/lib/auth";
import { apiError } from "@/lib/api/responses";

export async function requireAgent(): Promise<
  { ok: true; agent: SessionAgent } | { ok: false; response: NextResponse }
> {
  const agent = await getSessionAgent();
  if (!agent) {
    return { ok: false, response: apiError("UNAUTHORIZED", "Agent login required.", 401) };
  }
  return { ok: true, agent };
}
