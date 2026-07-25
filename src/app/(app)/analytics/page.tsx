import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { getAnalyticsDashboard } from "@/lib/analytics/dashboard";
import { formatCurrency } from "@/lib/booking";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

export default async function AnalyticsPage() {
  const agent = await getSessionAgent();
  if (!agent) redirect("/login");
  if (agent.role !== "admin") redirect("/dashboard");

  const data = await getAnalyticsDashboard(30);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            North Star, revenue, funnels · {data.environment}
            {!data.postgres && " · PostgreSQL required for event analytics"}
          </p>
        </div>
        <div className="text-xs text-gray-400">
          Updated {new Date(data.computedAt).toLocaleString()}
        </div>
      </div>

      {!data.postgres ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Connect Supabase (<code className="text-xs">SUPABASE_DB_PASSWORD</code>) and run{" "}
          <code className="text-xs">npm run db:push</code> +{" "}
          <code className="text-xs">npm run analytics:aggregate</code> for full analytics.
        </div>
      ) : null}

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        North Star — Paid passenger seats
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Today</div>
          <div className="value">{data.northStar.paidSeatsToday}</div>
        </div>
        <div className="stat-card">
          <div className="label">Last {data.periodDays} days</div>
          <div className="value">{data.northStar.paidSeatsPeriod}</div>
        </div>
        <div className="stat-card">
          <div className="label">GBV today</div>
          <div className="value text-lg">{formatCurrency(data.revenue.gbvToday)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active users today</div>
          <div className="value">{data.activeUsersToday}</div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Engineering health ({data.periodDays}d)
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Errors today</div>
          <div className="value">{data.errors.today}</div>
        </div>
        <div className="stat-card">
          <div className="label">Errors ({data.periodDays}d)</div>
          <div className="value">{data.errors.period}</div>
        </div>
        <div className="stat-card">
          <div className="label">Contact leads ({data.periodDays}d)</div>
          <div className="value">{data.contactSubmissionsPeriod}</div>
        </div>
        <div className="stat-card">
          <div className="label">Payment success (today)</div>
          <div className="value text-lg">{pct(data.paymentHealth.successRate)}</div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Revenue by channel ({data.periodDays}d)
      </h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-8">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Paid seats</th>
              <th>GBV</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue.byChannel.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-gray-400 py-6">
                  No paid bookings in period.
                </td>
              </tr>
            ) : (
              data.revenue.byChannel.map((row) => (
                <tr key={row.channel}>
                  <td className="font-medium">{row.channel}</td>
                  <td>{row.paidSeats}</td>
                  <td>{formatCurrency(row.gbv)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Funnel ({data.periodDays}d events)
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((row) => (
                  <tr key={row.step}>
                    <td className="text-sm font-mono">{row.step}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Acquisition (first touch)
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Identities</th>
                </tr>
              </thead>
              <tbody>
                {data.acquisition.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center text-gray-400 py-6">
                      No UTM attribution yet.
                    </td>
                  </tr>
                ) : (
                  data.acquisition.map((row) => (
                    <tr key={row.source}>
                      <td>{row.source}</td>
                      <td>{row.sessions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Payment health (today)
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="label">Succeeded</div>
          <div className="value">{data.paymentHealth.succeeded}</div>
        </div>
        <div className="stat-card">
          <div className="label">Failed</div>
          <div className="value">{data.paymentHealth.failed}</div>
        </div>
        <div className="stat-card">
          <div className="label">Success rate</div>
          <div className="value text-lg">{pct(data.paymentHealth.successRate)}</div>
        </div>
      </div>

      {data.northStar.trend.length > 0 ? (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Paid seats trend
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Paid seats</th>
                </tr>
              </thead>
              <tbody>
                {data.northStar.trend.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {data.errors.byCategory.length > 0 ? (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Errors by category ({data.periodDays}d)
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td className="font-mono text-sm">{row.category}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {data.topEventsToday.length > 0 ? (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Top events today
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.topEventsToday.map((row) => (
                  <tr key={row.eventName}>
                    <td className="text-sm font-mono">{row.eventName}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
