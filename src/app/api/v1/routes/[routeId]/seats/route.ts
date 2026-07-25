import { NextResponse } from "next/server";
import { getOrCreateTrip, getBookedSeats } from "@/lib/services";
import { ALL_SEATS } from "@/lib/seats";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ routeId: string }> }
) {
  const { routeId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  if (!date || !time) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "date and time are required." } },
      { status: 400 }
    );
  }

  const trip = getOrCreateTrip(routeId, date, time);
  const bookedSeats = getBookedSeats(trip.id);

  return NextResponse.json({
    data: {
      tripId: trip.id,
      routeId,
      date,
      departureTime: time,
      bookedSeats,
      layout: { rows: 12, letters: ["A", "B", "C", "D"], totalSeats: ALL_SEATS.length },
    },
  });
}
