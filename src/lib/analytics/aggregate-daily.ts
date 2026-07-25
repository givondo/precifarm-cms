import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getStore, ensureSeeded } from "@/db";
import { getDb, isPostgresEnabled } from "@/db/client";
import { analyticsDailyMetrics, analyticsEvents } from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import { parseSeats } from "@/lib/seats";

export type DailyMetricRow = {
  metricName: string;
  metricValue: number;
  dimensions: Record<string, string>;
};

function nextDate(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isProductionBookingPaid(
  booking: { id: string; status: string; bookingType: string; paidAt?: string },
  payments: { bookingId: string; status: string; isDemo: boolean }[]
): boolean {
  if (booking.status !== "paid" || !booking.paidAt) return false;
  const payment = payments.find((p) => p.bookingId === booking.id);
  if (payment?.isDemo) return false;
  return true;
}

function passengerSeats(booking: {
  bookingType: string;
  passengerCount?: number;
  seats: string;
}): number {
  if (booking.bookingType === "cargo") return 0;
  return booking.passengerCount ?? parseSeats(booking.seats).length;
}

/** Compute daily metrics from transactional store + analytics events. */
export async function computeDailyMetrics(
  metricDate: string,
  environment?: string
): Promise<DailyMetricRow[]> {
  const env = environment ?? getAnalyticsEnvironment();
  await ensureSeeded();
  const store = await getStore();
  const metrics: DailyMetricRow[] = [];

  const paidOnDate = store.bookings.filter(
    (b) =>
      b.paidAt?.startsWith(metricDate) &&
      isProductionBookingPaid(b, store.payments)
  );

  const paidSeats = paidOnDate
    .filter((b) => b.bookingType === "passenger")
    .reduce((sum, b) => sum + passengerSeats(b), 0);

  const gbv = paidOnDate.reduce((sum, b) => sum + b.totalAmount, 0);

  const createdOnDate = store.bookings.filter((b) => b.createdAt.startsWith(metricDate));

  const customerFirstPaid = new Map<string, string>();
  for (const b of store.bookings.filter((x) => x.status === "paid" && x.paidAt)) {
    const existing = customerFirstPaid.get(b.customerId);
    if (!existing || b.paidAt! < existing) {
      customerFirstPaid.set(b.customerId, b.paidAt!.slice(0, 10));
    }
  }
  const newCustomers = [...customerFirstPaid.values()].filter((d) => d === metricDate).length;

  metrics.push({ metricName: "paid_seats", metricValue: paidSeats, dimensions: {} });
  metrics.push({ metricName: "gbv", metricValue: gbv, dimensions: {} });
  metrics.push({ metricName: "bookings_created", metricValue: createdOnDate.length, dimensions: {} });
  metrics.push({ metricName: "new_customers", metricValue: newCustomers, dimensions: {} });

  const channelTotals = new Map<string, { gbv: number; seats: number }>();
  for (const b of paidOnDate) {
    const cur = channelTotals.get(b.channel) ?? { gbv: 0, seats: 0 };
    cur.gbv += b.totalAmount;
    if (b.bookingType === "passenger") cur.seats += passengerSeats(b);
    channelTotals.set(b.channel, cur);
  }
  for (const [channel, totals] of channelTotals) {
    metrics.push({
      metricName: "paid_seats",
      metricValue: totals.seats,
      dimensions: { channel },
    });
    metrics.push({
      metricName: "gbv",
      metricValue: totals.gbv,
      dimensions: { channel },
    });
  }

  const paymentsOnDate = store.payments.filter((p) => {
    const ts = p.completedAt ?? p.createdAt;
    return ts.startsWith(metricDate) && !p.isDemo;
  });
  const succeeded = paymentsOnDate.filter((p) => p.status === "completed").length;
  const failed = paymentsOnDate.filter((p) => p.status === "failed").length;
  metrics.push({ metricName: "payments_succeeded", metricValue: succeeded, dimensions: {} });
  metrics.push({ metricName: "payments_failed", metricValue: failed, dimensions: {} });

  if (isPostgresEnabled()) {
    const db = getDb();
    const dayStart = new Date(`${metricDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${nextDate(metricDate)}T00:00:00.000Z`);

    const eventCounts = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.environment, env),
          gte(analyticsEvents.eventTimestamp, dayStart),
          lt(analyticsEvents.eventTimestamp, dayEnd)
        )
      )
      .groupBy(analyticsEvents.eventName);

    for (const row of eventCounts) {
      metrics.push({
        metricName: "event_count",
        metricValue: row.count,
        dimensions: { event_name: row.eventName },
      });
    }

    const dauResult = await db
      .select({
        count: sql<number>`count(distinct coalesce(${analyticsEvents.customerId}, ${analyticsEvents.anonymousId}))::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.environment, env),
          gte(analyticsEvents.eventTimestamp, dayStart),
          lt(analyticsEvents.eventTimestamp, dayEnd)
        )
      );

    metrics.push({
      metricName: "active_users",
      metricValue: dauResult[0]?.count ?? 0,
      dimensions: {},
    });
  }

  return metrics;
}

/** Idempotent persist — replaces all metrics for date + environment. */
export async function persistDailyMetrics(
  metricDate: string,
  environment?: string
): Promise<number> {
  if (!isPostgresEnabled()) {
    console.warn("[analytics] PostgreSQL not configured — skip daily persist.");
    return 0;
  }

  const env = environment ?? getAnalyticsEnvironment();
  const rows = await computeDailyMetrics(metricDate, env);
  const db = getDb();

  await db
    .delete(analyticsDailyMetrics)
    .where(
      and(eq(analyticsDailyMetrics.metricDate, metricDate), eq(analyticsDailyMetrics.environment, env))
    );

  if (rows.length === 0) return 0;

  await db.insert(analyticsDailyMetrics).values(
    rows.map((row) => ({
      metricDate,
      environment: env,
      metricName: row.metricName,
      metricValue: String(row.metricValue),
      dimensions: row.dimensions,
    }))
  );

  return rows.length;
}

export async function aggregateDailyRange(
  startDate: string,
  endDate: string,
  environment?: string
): Promise<{ days: number; metricsWritten: number }> {
  let metricsWritten = 0;
  let days = 0;
  let cursor = startDate;

  while (cursor <= endDate) {
    metricsWritten += await persistDailyMetrics(cursor, environment);
    days++;
    cursor = nextDate(cursor);
  }

  return { days, metricsWritten };
}
