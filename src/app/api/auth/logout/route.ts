import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionAgent, revokeAgentSessions, SESSION_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/security/session";

/** Sign out: ends every session of this agent on the server, then clears the cookie. */
export async function POST() {
  const agent = await getSessionAgent();
  if (agent) await revokeAgentSessions(agent.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return NextResponse.json({ data: { ok: true } });
}
