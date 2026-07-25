import { NextResponse } from "next/server";
import { handleMpesaCallback } from "@/lib/services";
import type { MpesaCallbackBody } from "@/lib/mpesa";

export async function POST(request: Request) {
  let body: MpesaCallbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }

  const result = handleMpesaCallback(body);

  if ("error" in result && result.error) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: result.error });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
