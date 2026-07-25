import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import { completePayment, getOpenCashSession } from "@/lib/services";

export async function POST(request: Request) {
  const agent = await getSessionAgent();
  if (!agent) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Agent login required." } },
      { status: 401 }
    );
  }

  let body: { bookingId?: string; amountReceived?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 }
    );
  }

  if (!body.bookingId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "bookingId is required." } },
      { status: 400 }
    );
  }

  const session = await getOpenCashSession(agent.id);
  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "NO_CASH_SESSION",
          message: "Open a cash session before accepting cash payments.",
        },
      },
      { status: 422 }
    );
  }

  const result = await completePayment(body.bookingId, "cash", {
    agentId: agent.id,
    cashSessionId: session.id,
  });

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "PAYMENT_ERROR", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({
    data: {
      status: "success",
      reference: result.data!.reference,
      paidAt: result.data!.paidAt,
      receiptNumber: result.data!.cashReceipt,
    },
  });
}
