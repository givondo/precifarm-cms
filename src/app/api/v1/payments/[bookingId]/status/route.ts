import { NextResponse } from "next/server";
import { bookingRetiredResponse } from "@/lib/api/booking-gate";
import { getPaymentStatus } from "@/lib/services";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const retired = bookingRetiredResponse();
  if (retired) return retired;

  const { bookingId } = await params;
  const result = await getPaymentStatus(bookingId);

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data });
}
