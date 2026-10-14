import { NextResponse } from "next/server";
import { processStkPayment } from "@/lib/services";
import { bookingRetiredResponse } from "@/lib/api/booking-gate";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

const STK_LIMIT = 5;
const STK_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const retired = bookingRetiredResponse();
  if (retired) return retired;

  const ip = getClientIp(request);
  if (!checkRateLimit(`stk:${ip}`, STK_LIMIT, STK_WINDOW_MS)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many payment requests. Try again shortly." } },
      { status: 429 }
    );
  }

  let body: { bookingId?: string };
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

  const result = await processStkPayment(body.bookingId);

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "PAYMENT_ERROR", message: result.error } },
      { status: result.status }
    );
  }

  const data = result.data!;

  if (data.status === "success") {
    return NextResponse.json({
      data: {
        status: "success",
        reference: data.reference,
        mpesaReceipt: data.mpesaReceipt,
        paidAt: data.paidAt,
        demo: data.demo ?? false,
        message: data.demo
          ? "Demo payment successful. No M-Pesa charge was made."
          : "Payment completed.",
      },
    });
  }

  return NextResponse.json({ data });
}
