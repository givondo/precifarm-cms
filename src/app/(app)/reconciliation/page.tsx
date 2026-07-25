import { getReconciliationReport } from "@/lib/services";
import { getLocalDateString, formatCurrency } from "@/lib/booking";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? getLocalDateString();
  const report = getReconciliationReport(date);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Daily payment and booking summary</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" name="date" className="input" defaultValue={date} />
          </div>
          <button type="submit" className="btn btn-secondary">
            Load
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Revenue (paid)</div>
          <div className="value text-lg">{formatCurrency(report.bookings.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Bookings paid</div>
          <div className="value">{report.bookings.paid}</div>
        </div>
        <div className="stat-card">
          <div className="label">M-Pesa completed</div>
          <div className="value">{report.mpesa.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Cash collected</div>
          <div className="value text-lg">{formatCurrency(report.cash.totalCollected)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">M-Pesa</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1.5 text-gray-500">Completed</td>
                <td className="py-1.5 font-medium">{report.mpesa.total}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Amount</td>
                <td className="py-1.5 font-medium">{formatCurrency(report.mpesa.amount)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Demo</td>
                <td className="py-1.5">{report.mpesa.demo}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Failed</td>
                <td className="py-1.5">{report.mpesa.failed}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Pending</td>
                <td className="py-1.5">{report.mpesa.pending}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Bookings by channel</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(report.bookings.byChannel).map(([channel, count]) => (
                <tr key={channel}>
                  <td className="py-1.5 text-gray-500 capitalize">{channel.replace("_", " ")}</td>
                  <td className="py-1.5 font-medium">{count}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200">
                <td className="py-1.5 text-gray-500">Created today</td>
                <td className="py-1.5 font-bold">{report.bookings.created}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Refunded / cancelled</td>
                <td className="py-1.5">
                  {report.bookings.refunded} / {report.bookings.cancelled}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Tickets & SMS</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1.5 text-gray-500">Tickets issued</td>
                <td className="py-1.5 font-medium">{report.tickets.issued}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">SMS sent</td>
                <td className="py-1.5 text-green-700">{report.tickets.smsSent}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-500">Unmatched payments</td>
                <td className="py-1.5 text-red-600">{report.unmatched.paymentsWithoutTickets}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Cash sessions</h2>
          {report.agentSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No cash sessions on this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Collected</th>
                    <th>Expected</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {report.agentSessions.map((s, i) => (
                    <tr key={i}>
                      <td>{s.agentName}</td>
                      <td>{formatCurrency(s.cashCollected)}</td>
                      <td>{formatCurrency(s.expectedCash)}</td>
                      <td
                        className={
                          s.discrepancy != null && s.discrepancy !== 0
                            ? "text-red-600 font-medium"
                            : "text-green-700"
                        }
                      >
                        {s.discrepancy != null ? formatCurrency(s.discrepancy) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
