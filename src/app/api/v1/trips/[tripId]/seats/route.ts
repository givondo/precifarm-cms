import { NextResponse } from "next/server";
import { getTripById, getBookedSeats } from "@/lib/services";
import { getStore, ensureSeeded } from "@/db";
import { ALL_SEATS } from "@/lib/seats";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const trip = getTripById(tripId);

  if (!trip) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Trip not found." } },
      { status: 404 }
    );
  }

  ensureSeeded();
  const route = getStore().routes.find((r) => r.id === trip.routeId)!;
  const bookedSeats = getBookedSeats(tripId);

  return NextResponse.json({
    data: {
      tripId: trip.id,
      routeId: trip.routeId,
      date: trip.travelDate,
      departureTime: trip.departureTime,
      bookedSeats,
      heldSeats: [],
      layout: { rows: 12, letters: ["A", "B", "C", "D"], totalSeats: ALL_SEATS.length },
      route: { from: route.origin, to: route.destination },
    },
  });
}
