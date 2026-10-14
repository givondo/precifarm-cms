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

  // From here the caller is authenticated as Daraja. Daraja treats any non-200 reply
  // as a delivery failure and retries, so payload and lookup problems are reported
  // with HTTP 200 and ResultCode 1 instead. The raw callback is already in the audit
  // log for reconciliation. Unexpected exceptions still surface as 500 so a transient
  // store failure is retried rather than silently dropped.
  let body: MpesaCallbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" });
  }

  const result = await handleMpesaCallback(body);

  if ("error" in result && result.error) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: result.error });
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
