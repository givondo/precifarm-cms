import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import { getOpenCashSession, openCashSession } from "@/lib/services";

export async function GET() {
  const agent = await getSessionAgent();
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getOpenCashSession(agent.id);
  return NextResponse.json({ data: { session: session ?? null } });
}

export async function POST(request: Request) {
  const agent = await getSessionAgent();
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const openingFloat = body.openingFloat ?? 0;

  const result = await openCashSession(agent.id, openingFloat);
  if ("error" in result && result.error) {
    return NextResponse.json({ error: { message: result.error } }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: result.status });
}
