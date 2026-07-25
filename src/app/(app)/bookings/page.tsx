import { listBookings } from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { parseSeats } from "@/lib/seats";
import { getDeliveryStageLabel } from "@/lib/cargo";
import { BookingStatusBadge } from "@/components/ui/BookingStatusBadge";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; q?: string }>;
}) {
  const params = await searchParams;
  const results = listBookings({
    status: params.status,
    channel: params.channel,
    search: params.q,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500 mt-1">{results.length} booking(s) found</p>
      </div>

      <form method="get" className="flex gap-2 mb-4 max-w-md">
        <input
          type="search"
          name="q"
          className="input"
          placeholder="Search reference, name, phone…"
          defaultValue={params.q ?? ""}
        />
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.channel && <input type="hidden" name="channel" value={params.channel} />}
        <button type="submit" className="btn btn-secondary shrink-0">
          Search
        </button>
      </form>

      <div className="flex gap-2 mb-4 flex-wrap">
        <a
          href="/bookings"
          className={`btn btn-secondary text-xs ${!params.status ? "!bg-green-50 !border-green-200" : ""}`}
        >
          All
        </a>
        <a
          href="/bookings?status=paid"
          className={`btn btn-secondary text-xs ${params.status === "paid" ? "!bg-green-50 !border-green-200" : ""}`}
        >
          Paid
        </a>
        <a
          href="/bookings?status=pending"
          className={`btn btn-secondary text-xs ${params.status === "pending" ? "!bg-green-50 !border-green-200" : ""}`}
        >
          Pending
        </a>
        <a
          href="/bookings?channel=agent_walkin"
          className={`btn btn-secondary text-xs ${params.channel === "agent_walkin" ? "!bg-green-50 !border-green-200" : ""}`}
        >
          Walk-in
        </a>
        <a
          href="/bookings?channel=agent_callin"
          className={`btn btn-secondary text-xs ${params.channel === "agent_callin" ? "!bg-green-50 !border-green-200" : ""}`}
        >
          Call-in
        </a>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>ID / Passport</th>
              <th>Route</th>
              <th>Travel date</th>
              <th>Departure</th>
              <th>Seats</th>
              <th>Pax</th>
              <th>Amount</th>
              <th>Delivery</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center text-gray-400 py-8">
                  No bookings match your filters.
                </td>
              </tr>
            ) : (
              results.map(({ booking, trip, route, cargo }) => (
                <tr key={booking.id}>
                  <td className="font-mono text-xs font-medium">{booking.reference}</td>
                  <td className="text-xs capitalize">
                    {booking.bookingType}
                    {cargo?.lastMileDelivery && (
                      <span className="ml-1 text-green-700">· LMD</span>
                    )}
                  </td>
                  <td className="font-medium">{booking.contactName}</td>
                  <td className="text-sm">{formatPhoneDisplay(booking.contactPhone)}</td>
                  <td className="font-mono text-xs">{booking.contactIdNumber ?? "—"}</td>
                  <td className="text-sm">{route.label}</td>
                  <td className="text-sm">{trip.travelDate}</td>
                  <td className="text-sm">{trip.departureTime}</td>
                  <td className="text-sm">
                    {booking.bookingType === "cargo" && cargo
                      ? `${cargo.weightKg} kg`
                      : parseSeats(booking.seats).join(", ")}
                  </td>
                  <td className="text-sm text-center">{booking.passengerCount}</td>
                  <td className="font-medium">{formatCurrency(booking.totalAmount)}</td>
                  <td className="text-xs">
                    {booking.bookingType === "cargo" && booking.status === "paid" && cargo?.deliveryStatus
                      ? getDeliveryStageLabel(cargo.deliveryStatus)
                      : "—"}
                  </td>
                  <td className="text-xs text-gray-500">{booking.channel}</td>
                  <td>
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(booking.createdAt).toLocaleString("en-KE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
