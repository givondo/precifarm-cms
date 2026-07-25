import { NextResponse } from "next/server";
import { createBooking, completePayment } from "@/lib/services";
import type { CreateBookingInput } from "@/lib/booking";

export async function POST(request: Request) {
  let body: CreateBookingInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 }
    );
  }

  const result = createBooking({ ...body, channel: body.channel ?? "web" });
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "BOOKING_ERROR", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data }, { status: result.status });
}
