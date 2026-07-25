import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import {
  createBooking,
  completePayment,
  getOpenCashSession,
  processStkPayment,
} from "@/lib/services";
import type { CreateBookingInput } from "@/lib/booking";

export async function POST(request: Request) {
  const agent = await getSessionAgent();
  if (!agent) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Agent login required." } },
      { status: 401 }
    );
  }

  let body: CreateBookingInput & { paymentMethod?: "cash" | "mpesa" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 }
    );
  }

  const result = await createBooking({
    ...body,
    channel: body.channel ?? "agent_walkin",
    agentId: agent.id,
  });

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "BOOKING_ERROR", message: result.error } },
      { status: result.status }
    );
  }

  const paymentMethod = body.paymentMethod ?? "cash";

  if (paymentMethod === "cash") {
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

    const payment = await completePayment(result.data!.bookingId, "cash", {
      agentId: agent.id,
      cashSessionId: session.id,
    });

    if ("error" in payment && payment.error) {
      return NextResponse.json(
        { error: { code: "PAYMENT_ERROR", message: payment.error } },
        { status: payment.status }
      );
    }

    return NextResponse.json(
      {
        data: {
          ...result.data,
          status: "paid",
          receipt: payment.data?.cashReceipt,
          smsBody: payment.data?.smsBody,
        },
      },
      { status: 201 }
    );
  }

  // M-Pesa Express STK (live when DEMO_PAYMENT=false + Daraja creds; else demo)
  const payment = await processStkPayment(result.data!.bookingId);

  if ("error" in payment && payment.error) {
    return NextResponse.json(
      { error: { code: "PAYMENT_ERROR", message: payment.error } },
      { status: payment.status }
    );
  }

  const pdata = payment.data!;

  if (pdata.status === "success") {
    return NextResponse.json(
      {
        data: {
          ...result.data,
          status: "paid",
          receipt: pdata.mpesaReceipt,
          smsBody: pdata.smsBody,
          demo: pdata.demo ?? false,
        },
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      data: {
        ...result.data,
        status: "pending",
        paymentStatus: "pending",
        message: pdata.message,
        checkoutRequestId: pdata.checkoutRequestId,
        demo: false,
      },
    },
    { status: 201 }
  );
}
