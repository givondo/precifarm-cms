import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import {
  createCargoBooking,
  completePayment,
  getOpenCashSession,
  processStkPayment,
} from "@/lib/services";
import type { CreateCargoBookingInput } from "@/lib/cargo";

export async function POST(request: Request) {
  const agent = await getSessionAgent();
  let body: CreateCargoBookingInput & { paymentMethod?: "cash" | "mpesa" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 }
    );
  }

  const result = await createCargoBooking({
    ...body,
    channel: body.channel ?? (agent ? "agent_walkin" : "web"),
    agentId: agent?.id,
  });

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "BOOKING_ERROR", message: result.error } },
      { status: result.status }
    );
  }

  const paymentMethod = body.paymentMethod;

  if (!paymentMethod || paymentMethod === "mpesa") {
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
            demo: pdata.demo,
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
        },
      },
      { status: 201 }
    );
  }

  if (!agent) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Agent login required for cash." } },
      { status: 401 }
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
