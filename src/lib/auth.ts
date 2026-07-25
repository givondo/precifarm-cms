import { getStore, ensureSeeded } from "@/db";
import type { StoreAgent } from "@/db/store";

export const SESSION_COOKIE = "precifarm_agent_session";

export type SessionAgent = Pick<StoreAgent, "id" | "email" | "name" | "role" | "branch">;

export async function getSessionAgent(): Promise<SessionAgent | null> {
  ensureSeeded();
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const agentId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!agentId) return null;

  const agent = getStore().agents.find((a) => a.id === agentId && a.isActive);
  if (!agent) return null;

  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    branch: agent.branch,
  };
}

export function authenticateAgent(email: string, password: string): SessionAgent | null {
  ensureSeeded();
  const agent = getStore().agents.find(
    (a) => a.email === email && a.password === password && a.isActive
  );
  if (!agent) return null;

  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    branch: agent.branch,
  };
}
