import { NextResponse } from "next/server";

/**
 * Passenger and cargo booking (Nairobi to Kisumu bus) is retired. The public and
 * agent booking surface stays off unless BOOKING_ENABLED=true is set explicitly.
 */
export function isBookingEnabled(): boolean {
  return process.env.BOOKING_ENABLED?.trim().toLowerCase() === "true";
}

/** Returns a 410 response when booking is disabled, otherwise null. */
export function bookingRetiredResponse(): NextResponse | null {
  if (isBookingEnabled()) return null;
  return NextResponse.json(
    { error: { code: "BOOKING_RETIRED", message: "Booking has been retired and is no longer available." } },
    { status: 410 }
  );
}
