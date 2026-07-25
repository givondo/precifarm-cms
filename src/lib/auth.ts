import { getStore, ensureSeeded } from "@/db";
import type { StoreAgent } from "@/db/store";

export const SESSION_COOKIE = "precifarm_agent_session";

export type SessionAgent = Pick<StoreAgent, "id" | "email" | "name" | "role" | "branch">;

export async function getSessionAgent(): Promise<SessionAgent | null> {
  await ensureSeeded();
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const agentId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!agentId) return null;

  const store = await getStore();
  const agent = store.agents.find((a) => a.id === agentId && a.isActive);
  if (!agent) return null;

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
  const agent = store.agents.find(
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
