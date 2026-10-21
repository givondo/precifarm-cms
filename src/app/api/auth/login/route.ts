import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateAgent, SESSION_COOKIE } from "@/lib/auth";
import { trackCmsAudit, trackServerEvent } from "@/lib/analytics";
import { getSessionSecret, sessionCookieOptions, signSessionToken } from "@/lib/security/session";
import { checkRateLimit, getClientIp, rateLimited } from "@/lib/api/rate-limit";

/** Failed login attempts per client IP per window, to slow password guessing. Successful sign-ins do not count, so agents behind one office address do not block each other. */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({ error: "Login is unavailable: session secret not configured." }, { status: 503 });
  }

  const ip = getClientIp(request);
  if (rateLimited(`login:${ip}`, LOGIN_LIMIT)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429, headers: { "Retry-After": String(LOGIN_WINDOW_MS / 1000) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }

  const agent = await authenticateAgent(email, password);
  if (!agent) {
    checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    trackServerEvent("cms_login_failed", { email_domain: email.includes("@") ? email.split("@")[1] : "unknown" }, {
      platform: "cms",
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSessionToken(agent.id, secret), sessionCookieOptions());

  // No agent identifiers in product analytics; the CMS audit log below records the actor.
  trackServerEvent(
    "cms_login_succeeded",
    { role: agent.role, branch: agent.branch ?? "" },
    { platform: "cms" }
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
