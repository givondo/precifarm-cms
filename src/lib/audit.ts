import crypto from "crypto";
import { mutateStore } from "@/db";

export async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  actorType: string,
  actorId?: string,
  payload?: unknown
) {
  await mutateStore((s) => {
    s.auditEvents.push({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      action,
      actorType,
      actorId,
      payload: payload ? JSON.stringify(payload) : undefined,
      createdAt: new Date().toISOString(),
    });
  });
}
