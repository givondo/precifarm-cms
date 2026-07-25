import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import { closeCashSession } from "@/lib/services";

export async function POST(request: Request) {
  const agent = await getSessionAgent();
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, actualCash, notes } = body as {
    sessionId?: string;
    actualCash?: number;
    notes?: string;
  };

  if (!sessionId || actualCash === undefined) {
    return NextResponse.json({ error: { message: "sessionId and actualCash required." } }, { status: 400 });
  }

  const result = await closeCashSession(sessionId, agent.id, actualCash, notes);
  if ("error" in result && result.error) {
    return NextResponse.json({ error: { message: result.error } }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
