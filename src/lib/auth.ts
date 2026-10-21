import { getStore, mutateStore, ensureSeeded } from "@/db";
import type { StoreAgent } from "@/db/store";
import { getSessionSecret, verifySessionToken } from "@/lib/security/session";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/security/password";

/**
 * In production the cookie takes the __Host- prefix: Secure, path /, no Domain, so no other
 * precifarm.com subdomain can set or overwrite it.
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-precifarm_agent_session" : "precifarm_agent_session";

export type SessionAgent = Pick<StoreAgent, "id" | "email" | "name" | "role" | "branch">;

export async function getSessionAgent(): Promise<SessionAgent | null> {
  await ensureSeeded();
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const secret = getSessionSecret();
  if (!secret) return null;
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, secret);
  if (!session) return null;
  const agentId = session.sub;

  const store = await getStore();
  const agent = store.agents.find((a) => a.id === agentId && a.isActive);
  if (!agent) return null;
  // Sign-out and password changes set sessionsNotBefore; older sessions (or ones without an issue
  // time) stop working on every device.
  const issuedMs = session.iatMs ?? (session.iat ?? 0) * 1000;
  if (agent.sessionsNotBefore && issuedMs <= agent.sessionsNotBefore) return null;

  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    branch: agent.branch,
  };
}

export async function authenticateAgent(
  email: string,
  password: string
): Promise<SessionAgent | null> {
  await ensureSeeded();
  const store = await getStore();
  const normalizedEmail = email.trim().toLowerCase();
  const agent = store.agents.find(
    (a) => a.email.trim().toLowerCase() === normalizedEmail && a.isActive
  );
  if (!agent) {
    burnPasswordCheck(password);
    return null;
  }

  const check = verifyPassword(password, agent.password);
  if (!check.ok) return null;

  if (check.needsUpgrade) {
    // Legacy plaintext accepted (ALLOW_LEGACY_PLAINTEXT=true): replace with a scrypt hash.
    const upgraded = hashPassword(password);
    await mutateStore((s) => {
      const a = s.agents.find((x) => x.id === agent.id);
      if (a) a.password = upgraded;
    });
  }

  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    branch: agent.branch,
  };
}

/** End every session of this agent, on every device. */
export async function revokeAgentSessions(agentId: string, nowMs = Date.now()): Promise<void> {
  await mutateStore((store) => {
    const a = store.agents.find((x) => x.id === agentId);
    // Milliseconds, matching the token's iatMs: sessions issued up to now end, the next sign-in works.
    if (a) a.sessionsNotBefore = nowMs;
  });
}

/**
 * For server pages: the signed-in agent, or a redirect to /login. Each page calls this itself,
 * because Next.js can render a page segment without re-running the (app) layout on client
 * navigation requests, so the layout's check alone does not protect page data.
 */
export async function requirePageAgent(): Promise<SessionAgent> {
  const agent = await getSessionAgent();
  if (!agent) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return agent as SessionAgent;
}
