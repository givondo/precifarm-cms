import { NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/services";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const result = getPaymentStatus(bookingId);

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data });
}
