import { NextResponse } from "next/server";
import { handleMpesaCallback } from "@/lib/services";
import type { MpesaCallbackBody } from "@/lib/mpesa";
import { authorizeMpesaCallback } from "@/lib/security/mpesa-callback";

/**
 * Daraja STK callback. Requires the shared token from MPESA_CALLBACK_TOKEN in the
 * `token` query parameter (appended automatically to CallBackURL on STK push), and
 * optionally a source IP listed in MPESA_CALLBACK_ALLOWED_IPS.
 */
export async function POST(request: Request) {
  const auth = authorizeMpesaCallback(request);
  if (!auth.ok) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: auth.reason }, { status: auth.status });
  }

  let body: MpesaCallbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }

  const result = await handleMpesaCallback(body);

  if ("error" in result && result.error) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: result.error }, { status: result.status });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
