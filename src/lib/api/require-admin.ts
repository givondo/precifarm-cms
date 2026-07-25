import { NextResponse } from "next/server";
import { getSessionAgent, type SessionAgent } from "@/lib/auth";
import { apiError } from "@/lib/api/responses";

export async function requireAdmin(): Promise<
  { ok: true; agent: SessionAgent } | { ok: false; response: NextResponse }
> {
  const agent = await getSessionAgent();
  if (!agent) {
    return { ok: false, response: apiError("UNAUTHORIZED", "Agent login required.", 401) };
  }
  if (agent.role !== "admin") {
    return { ok: false, response: apiError("FORBIDDEN", "Admin access required.", 403) };
  }
  return { ok: true, agent };
}
