import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateAgent, SESSION_COOKIE } from "@/lib/auth";
import { trackCmsAudit, trackServerEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }

  const agent = await authenticateAgent(email, password);
  if (!agent) {
    trackServerEvent("cms_login_failed", { email_domain: email.includes("@") ? email.split("@")[1] : "unknown" }, {
      platform: "cms",
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, agent.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  trackServerEvent(
    "cms_login_succeeded",
    { role: agent.role, branch: agent.branch ?? "", agent_id: agent.id },
    { platform: "cms", session_id: agent.id }
  );
  trackCmsAudit({
    actorId: agent.id,
    actorRole: agent.role,
    action: "cms_login_succeeded",
    objectType: "agent",
    objectId: agent.id,
  });

  return NextResponse.json({ data: { agent } });
}
