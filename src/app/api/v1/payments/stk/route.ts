import { NextResponse } from "next/server";
import { processStkPayment } from "@/lib/services";

export async function POST(request: Request) {
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
