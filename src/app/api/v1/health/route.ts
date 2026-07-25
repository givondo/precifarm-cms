import { NextResponse } from "next/server";
import { envSummary } from "@/lib/env";

/** Public health check — no secrets, safe for ops monitoring. */
export async function GET() {
  const summary = envSummary();
  return NextResponse.json({
    data: {
      ok: true,
      ...summary,
    },
  });
}
