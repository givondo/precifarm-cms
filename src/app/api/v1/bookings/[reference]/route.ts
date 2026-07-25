import { NextResponse } from "next/server";
import { getBookingByReference } from "@/lib/services";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const result = getBookingByReference(reference);

  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data });
}
