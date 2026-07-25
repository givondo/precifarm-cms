import { listCustomers } from "@/lib/services";
import { formatPhoneDisplay } from "@/lib/booking";

export default function CustomersPage() {
  const customersWithBookings = listCustomers();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Phone-based customer records from walk-in, call-in and web bookings
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Bookings</th>
              <th>Paid</th>
              <th>Last reference</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {customersWithBookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  No customers yet. They are created automatically when you book.
                </td>
              </tr>
            ) : (
              customersWithBookings.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name ?? "—"}</td>
                  <td className="text-sm">{formatPhoneDisplay(c.phoneE164)}</td>
                  <td className="text-sm text-gray-500">{c.email ?? "—"}</td>
                  <td className="text-center">{c.bookingCount}</td>
                  <td className="text-center">{c.paidCount}</td>
                  <td className="font-mono text-xs">
                    {c.lastBooking?.reference ?? "—"}
                  </td>
                  <td className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleDateString("en-KE")}
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
