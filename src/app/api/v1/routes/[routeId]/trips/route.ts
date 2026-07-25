import { NextResponse } from "next/server";
import { listTripsForRoute } from "@/lib/services";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ routeId: string }> }
) {
  const { routeId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "date query parameter is required." } },
      { status: 400 }
    );
  }

  const result = await listTripsForRoute(routeId, date);
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: result.error } },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: result.data });
}
