import { NextResponse } from "next/server";
import { bookingRetiredResponse } from "@/lib/api/booking-gate";
import { getBookingByReference } from "@/lib/services";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  // Public lookup returns passenger and cargo contact details; retired with booking.
  const retired = bookingRetiredResponse();
  if (retired) return retired;

  const { reference } = await params;
  const result = await getBookingByReference(reference);

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data });
}
