import {
  getDashboardStats,
  listChargingSessions,
  listInstallOrders,
} from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { getPaymentMode } from "@/lib/env";
import { paymentModeDisplay } from "@/lib/payment-ui";
import { chargingSiteLabels, installProductLabels } from "@/lib/ev-ops";
import { chargingFlow, installFlow, PRODUCT_KEY, SITE_KEY } from "@/lib/flow";
import FlowStrip from "@/components/FlowStrip";
import StageSteps from "@/components/StageSteps";
import Link from "next/link";
import { requirePageAgent } from "@/lib/auth";

export default async function DashboardPage() {
  await requirePageAgent();
  const stats = await getDashboardStats();
  const installs = await listInstallOrders();
  const sessions = await listChargingSessions();
  const recentInstalls = installs.slice(0, 5);
  const recentSessions = sessions.slice(0, 5);
  const payment = paymentModeDisplay(getPaymentMode());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">How home installs and public charging are moving today.</p>
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

      <div className="flow-head">
        <h2>
          <Link href="/installs">Home installs</Link>
        </h2>
        <span className="flow-facts">
          <span>
            <b>{stats.surveysToday}</b> surveys today
          </span>
          <span>
            <b>{stats.lipaPolePoleActive}</b> on Lipa Pole Pole
          </span>
          <span>
            <b>{formatCurrency(stats.installDepositsTotal)}</b> in deposits
          </span>
        </span>
      </div>
      <FlowStrip label="Home install pipeline" stations={installFlow(installs)} legend={PRODUCT_KEY} />

      <div className="flow-head">
        <h2>
          <Link href="/charging-sessions">Public charging</Link>
        </h2>
        <span className="flow-facts">
          <span>
            <b>{stats.chargingSessionsToday}</b> sessions today
          </span>
          <span>
            <b>{stats.kwhDeliveredToday}</b> kWh today
          </span>
        </span>
      </div>
      <FlowStrip label="Public charging sessions" stations={chargingFlow(sessions)} legend={SITE_KEY} />

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent install orders</h2>
            <Link href="/installs" className="text-sm text-green-800 hover:underline">
              View all
            </Link>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>City</th>
                  <th>Stage</th>
                  <th>Customer</th>
                </tr>
              </thead>
              <tbody>
                {recentInstalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-8">
                      No install orders yet.
                    </td>
                  </tr>
                ) : (
                  recentInstalls.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono text-xs">{order.reference}</td>
                      <td className="text-sm">{installProductLabels[order.product]}</td>
                      <td className="text-sm">{order.city}</td>
                      <td>
                        <StageSteps stage={order.stage} />
                      </td>
                      <td>
                        <div className="font-medium text-sm">{order.contactName}</div>
                        <div className="text-xs text-gray-500">
                          {formatPhoneDisplay(order.contactPhone)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent charging sessions</h2>
            <Link href="/charging-sessions" className="text-sm text-green-800 hover:underline">
              View all
            </Link>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Site</th>
                  <th>kWh</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-8">
                      No charging sessions yet.
                    </td>
                  </tr>
                ) : (
                  recentSessions.map((session) => (
                    <tr key={session.id}>
                      <td className="font-mono text-xs">{session.reference}</td>
                      <td className="text-sm">
                        {chargingSiteLabels[session.siteType]}
                        <div className="text-xs text-gray-500">{session.siteName}</div>
                      </td>
                      <td className="text-sm">{session.kwhDelivered ?? "n/a"}</td>
                      <td className="font-medium">{formatCurrency(session.amountKes)}</td>
                      <td className="text-sm capitalize">{session.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
