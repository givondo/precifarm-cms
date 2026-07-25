import { getDashboardStats, listBookings } from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { parseSeats } from "@/lib/seats";
import { getPaymentMode } from "@/lib/env";
import { paymentModeDisplay } from "@/lib/payment-ui";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/ui/BookingStatusBadge";

const quickLinks = [
  {
    href: "/quick-book",
    title: "Quick Book",
    desc: "Passenger tickets · cash or M-Pesa Express STK",
  },
  {
    href: "/cargo-book",
    title: "Cargo Book",
    desc: "Waybills · last mile (+KSh 500) · National ID required",
  },
  {
    href: "/delivery",
    title: "Delivery tracking",
    desc: "Advance cargo stages and send SMS updates",
  },
  {
    href: "/last-mile",
    title: "Last mile",
    desc: "Assign riders and dispatch door delivery",
  },
];

export default function DashboardPage() {
  const stats = getDashboardStats();
  const recent = listBookings().slice(0, 8);
  const payment = paymentModeDisplay(getPaymentMode());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Nairobi–Kisumu · Passenger & cargo operations
          </p>
        </div>
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            payment.tone === "live"
              ? "bg-green-50 border-green-200 text-green-800"
              : payment.tone === "warn"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-gray-50 border-gray-200 text-gray-700"
          }`}
        >
          <span className="font-medium">{payment.label}</span>
          <span className="text-xs block opacity-80">{payment.detail}</span>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Passenger
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Today&apos;s tickets</div>
          <div className="value">{stats.todayBookings}</div>
        </div>
        <div className="stat-card">
          <div className="label">Paid bookings</div>
          <div className="value">{stats.paidBookings}</div>
        </div>
        <div className="stat-card">
          <div className="label">Revenue (paid)</div>
          <div className="value text-lg">{formatCurrency(stats.totalRevenue)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Agent bookings</div>
          <div className="value">{stats.agentBookings}</div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Cargo & delivery
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Cargo waybills</div>
          <div className="value">{stats.cargoBookings}</div>
        </div>
        <div className="stat-card">
          <div className="label">Today&apos;s cargo</div>
          <div className="value">{stats.todayCargo}</div>
        </div>
        <Link href="/delivery" className="stat-card hover:border-green-300 transition-colors">
          <div className="label">Active deliveries</div>
          <div className="value">{stats.activeDeliveries}</div>
        </Link>
        <Link href="/last-mile" className="stat-card hover:border-green-300 transition-colors">
          <div className="label">Last mile ready</div>
          <div className="value">{stats.lastMileReady}</div>
        </Link>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Quick actions
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="quick-link">
            <div className="title">{link.title}</div>
            <div className="desc">{link.desc}</div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent bookings</h2>
        <Link href="/bookings" className="text-sm text-green-800 hover:underline">
          View all
        </Link>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Route</th>
              <th>Date / Time</th>
              <th>Detail</th>
              <th>Amount</th>
              <th>Channel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-gray-400 py-8">
                  No bookings yet. Create one from Quick Book or Cargo Book.
                </td>
              </tr>
            ) : (
              recent.map(({ booking, trip, route }) => (
                <tr key={booking.id}>
                  <td className="font-mono text-xs font-medium">{booking.reference}</td>
                  <td className="text-xs capitalize text-gray-500">
                    {booking.bookingType === "cargo" ? "Cargo" : "Passenger"}
                  </td>
                  <td>
                    <div className="font-medium">{booking.contactName}</div>
                    <div className="text-xs text-gray-500">
                      {formatPhoneDisplay(booking.contactPhone)}
                    </div>
                  </td>
                  <td className="text-sm">{route.label}</td>
                  <td className="text-sm whitespace-nowrap">
                    {trip.travelDate}
                    <br />
                    <span className="text-gray-500">{trip.departureTime}</span>
                  </td>
                  <td className="text-sm">
                    {booking.bookingType === "cargo"
                      ? "Waybill"
                      : parseSeats(booking.seats).join(", ")}
                  </td>
                  <td className="font-medium">{formatCurrency(booking.totalAmount)}</td>
                  <td className="text-xs text-gray-500">{booking.channel}</td>
                  <td>
                    <BookingStatusBadge status={booking.status} />
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
