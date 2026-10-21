import {
  getDashboardStats,
  listChargingSessions,
  listInstallOrders,
} from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { getPaymentMode } from "@/lib/env";
import { paymentModeDisplay } from "@/lib/payment-ui";
import {
  chargingSiteLabels,
  installProductLabels,
  installStageBadgeClass,
  installStageLabels,
} from "@/lib/ev-ops";
import Link from "next/link";
import { requirePageAgent } from "@/lib/auth";

const quickLinks = [
  {
    href: "/installs",
    title: "Home installs",
    desc: "Pulse, Pod and Spark — survey to commissioning",
  },
  {
    href: "/charging-sessions",
    title: "Charging sessions",
    desc: "Corridor DC, Depot, Boda Hub — kWh and M-Pesa",
  },
  {
    href: "/customers",
    title: "Customers",
    desc: "Lookup by phone, install ref or session ref",
  },
  {
    href: "/reconciliation",
    title: "M-Pesa reconciliation",
    desc: "Deposits, instalments and session payments",
  },
];

export default async function DashboardPage() {
  await requirePageAgent();
  const stats = await getDashboardStats();
  const recentInstalls = (await listInstallOrders()).slice(0, 5);
  const recentSessions = (await listChargingSessions()).slice(0, 5);
  const payment = paymentModeDisplay(getPaymentMode());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            EV charging — home installs, public sessions and M-Pesa
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
        Home charging pipeline
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/installs" className="stat-card hover:border-green-300 transition-colors">
          <div className="label">Survey pipeline</div>
          <div className="value">{stats.surveyPipeline}</div>
        </Link>
        <div className="stat-card">
          <div className="label">Surveys today</div>
          <div className="value">{stats.surveysToday}</div>
        </div>
        <Link href="/installs" className="stat-card hover:border-green-300 transition-colors">
          <div className="label">Commissioned (total)</div>
          <div className="value">{stats.commissionedTotal}</div>
        </Link>
        <div className="stat-card">
          <div className="label">Lipa Pole Pole active</div>
          <div className="value">{stats.lipaPolePoleActive}</div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Public charging
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/charging-sessions"
          className="stat-card hover:border-green-300 transition-colors"
        >
          <div className="label">Sessions today</div>
          <div className="value">{stats.chargingSessionsToday}</div>
        </Link>
        <div className="stat-card">
          <div className="label">kWh delivered today</div>
          <div className="value">{stats.kwhDeliveredToday}</div>
        </div>
        <div className="stat-card">
          <div className="label">Session revenue</div>
          <div className="value text-lg">{formatCurrency(stats.sessionRevenueTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Install deposits</div>
          <div className="value text-lg">{formatCurrency(stats.installDepositsTotal)}</div>
        </div>
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
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${installStageBadgeClass[order.stage]}`}
                        >
                          {installStageLabels[order.stage]}
                        </span>
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
                      <td className="text-sm">{session.kwhDelivered ?? "—"}</td>
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
