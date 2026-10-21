import { listChargingSessions } from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { chargingSiteLabels } from "@/lib/ev-ops";
import { requirePageAgent } from "@/lib/auth";

export default async function ChargingSessionsPage() {
  await requirePageAgent();
  const sessions = await listChargingSessions();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Charging sessions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Corridor DC, Depot, Boda Hub and home — kWh delivered and M-Pesa settlement
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Site type</th>
              <th>Site</th>
              <th>City</th>
              <th>kWh</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-gray-400 py-8">
                  No charging sessions yet.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id}>
                  <td className="font-mono text-xs font-medium">{session.reference}</td>
                  <td className="text-sm">{chargingSiteLabels[session.siteType]}</td>
                  <td className="text-sm">{session.siteName}</td>
                  <td className="text-sm">{session.city}</td>
                  <td className="text-sm">{session.kwhDelivered ?? "—"}</td>
                  <td className="font-medium">{formatCurrency(session.amountKes)}</td>
                  <td className="text-sm uppercase">{session.paymentMethod}</td>
                  <td className="text-xs text-gray-500">
                    {session.contactPhone ? formatPhoneDisplay(session.contactPhone) : "—"}
                  </td>
                  <td className="text-sm capitalize">{session.status}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {session.completedAt
                      ? new Date(session.completedAt).toLocaleString()
                      : "—"}
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
