import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ensureSeeded, getStore } from "@/db";
import { getDb, isPostgresEnabled } from "@/db/client";
import {
  analyticsAcquisition,
  analyticsDailyMetrics,
  analyticsErrors,
  analyticsEvents,
  contactSubmissions,
} from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import { getLocalDateString } from "@/lib/booking";
import { parseSeats } from "@/lib/seats";
import { computeDailyMetrics } from "@/lib/analytics/aggregate-daily";

export type MetricTrendPoint = { date: string; value: number };

export type AnalyticsDashboardData = {
  environment: string;
  postgres: boolean;
  periodDays: number;
  computedAt: string;
  northStar: {
    paidSeatsToday: number;
    paidSeatsPeriod: number;
    trend: MetricTrendPoint[];
  };
  revenue: {
    gbvToday: number;
    gbvPeriod: number;
    byChannel: { channel: string; gbv: number; paidSeats: number }[];
  };
  funnel: { step: string; count: number }[];
  acquisition: { source: string; sessions: number }[];
  activeUsersToday: number;
  paymentHealth: {
    succeeded: number;
    failed: number;
    successRate: number | null;
  };
  topEventsToday: { eventName: string; count: number }[];
  errors: {
    today: number;
    period: number;
    byCategory: { category: string; count: number }[];
    byPlatform: { platform: string; count: number }[];
  };
  contactSubmissionsPeriod: number;
};

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function getAnalyticsDashboard(periodDays = 30): Promise<AnalyticsDashboardData> {
  const environment = getAnalyticsEnvironment();
  const postgres = isPostgresEnabled();
  const today = getLocalDateString();
  const periodStart = addDays(today, -(periodDays - 1));
  await ensureSeeded();
  const store = await getStore();

  const paidInPeriod = store.bookings.filter((b) => {
    if (b.status !== "paid" || !b.paidAt) return false;
    const payment = store.payments.find((p) => p.bookingId === b.id);
    if (payment?.isDemo) return false;
    return b.paidAt.slice(0, 10) >= periodStart && b.paidAt.slice(0, 10) <= today;
  });

  const paidToday = paidInPeriod.filter((b) => b.paidAt!.startsWith(today));

  const seatCount = (b: (typeof paidInPeriod)[0]) =>
    b.bookingType === "cargo" ? 0 : b.passengerCount ?? parseSeats(b.seats).length;

  const paidSeatsToday = paidToday
    .filter((b) => b.bookingType === "passenger")
    .reduce((s, b) => s + seatCount(b), 0);

  const paidSeatsPeriod = paidInPeriod
    .filter((b) => b.bookingType === "passenger")
    .reduce((s, b) => s + seatCount(b), 0);

  const gbvToday = paidToday.reduce((s, b) => s + b.totalAmount, 0);
  const gbvPeriod = paidInPeriod.reduce((s, b) => s + b.totalAmount, 0);

  const channelMap = new Map<string, { gbv: number; paidSeats: number }>();
  for (const b of paidInPeriod) {
    const cur = channelMap.get(b.channel) ?? { gbv: 0, paidSeats: 0 };
    cur.gbv += b.totalAmount;
    if (b.bookingType === "passenger") cur.paidSeats += seatCount(b);
    channelMap.set(b.channel, cur);
  }

  const byChannel = [...channelMap.entries()]
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.gbv - a.gbv);

  let trend: MetricTrendPoint[] = [];
  let funnel: { step: string; count: number }[] = [];
  let acquisition: { source: string; sessions: number }[] = [];
  let activeUsersToday = 0;
  let topEventsToday: { eventName: string; count: number }[] = [];
  let paymentHealth = { succeeded: 0, failed: 0, successRate: null as number | null };
  let errors = {
    today: 0,
    period: 0,
    byCategory: [] as { category: string; count: number }[],
    byPlatform: [] as { platform: string; count: number }[],
  };
  let contactSubmissionsPeriod = 0;

  if (postgres) {
    const db = getDb();

    const trendRows = await db
      .select({
        metricDate: analyticsDailyMetrics.metricDate,
        value: sql<number>`sum(${analyticsDailyMetrics.metricValue}::numeric)::float`,
      })
      .from(analyticsDailyMetrics)
      .where(
        and(
          eq(analyticsDailyMetrics.environment, environment),
          eq(analyticsDailyMetrics.metricName, "paid_seats"),
          sql`${analyticsDailyMetrics.dimensions} = '{}'::jsonb`,
          gte(analyticsDailyMetrics.metricDate, periodStart)
        )
      )
      .groupBy(analyticsDailyMetrics.metricDate)
      .orderBy(analyticsDailyMetrics.metricDate);

    trend = trendRows.map((r) => ({
      date: String(r.metricDate),
      value: Number(r.value) || 0,
    }));

    if (trend.length === 0) {
      const liveToday = await computeDailyMetrics(today, environment);
      const seats = liveToday.find(
        (m) => m.metricName === "paid_seats" && Object.keys(m.dimensions).length === 0
      );
      if (seats) trend = [{ date: today, value: seats.metricValue }];
    }

    const funnelEvents = [
      "website_session_started",
      "website_booking_search_submitted",
      "website_booking_created",
      "website_payment_succeeded",
      "booking_paid",
      "mobile_booking_completed",
    ];

    const periodStartTs = new Date(`${periodStart}T00:00:00.000Z`);
    const funnelRows = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.environment, environment),
          gte(analyticsEvents.eventTimestamp, periodStartTs)
        )
      )
      .groupBy(analyticsEvents.eventName);

    const funnelMap = new Map(funnelRows.map((r) => [r.eventName, r.count]));
    funnel = funnelEvents.map((step) => ({
      step,
      count: funnelMap.get(step) ?? 0,
    }));

    const acqRows = await db
      .select({
        source: analyticsAcquisition.firstTouchSource,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsAcquisition)
      .where(sql`${analyticsAcquisition.firstTouchSource} is not null`)
      .groupBy(analyticsAcquisition.firstTouchSource)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    acquisition = acqRows.map((r) => ({
      source: r.source ?? "unknown",
      sessions: r.count,
    }));

    const todayStart = new Date(`${today}T00:00:00.000Z`);
    const dau = await db
      .select({
        count: sql<number>`count(distinct coalesce(${analyticsEvents.customerId}, ${analyticsEvents.anonymousId}))::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.environment, environment),
          gte(analyticsEvents.eventTimestamp, todayStart)
        )
      );
    activeUsersToday = dau[0]?.count ?? 0;

    const eventRows = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.environment, environment),
          gte(analyticsEvents.eventTimestamp, todayStart)
        )
      )
      .groupBy(analyticsEvents.eventName)
      .orderBy(desc(sql`count(*)`))
      .limit(12);

    topEventsToday = eventRows.map((r) => ({
      eventName: r.eventName,
      count: r.count,
    }));

    const payRows = await db
      .select({
        metricName: analyticsDailyMetrics.metricName,
        value: sql<number>`sum(${analyticsDailyMetrics.metricValue}::numeric)::float`,
      })
      .from(analyticsDailyMetrics)
      .where(
        and(
          eq(analyticsDailyMetrics.environment, environment),
          eq(analyticsDailyMetrics.metricDate, today),
          sql`${analyticsDailyMetrics.metricName} in ('payments_succeeded', 'payments_failed')`,
          sql`${analyticsDailyMetrics.dimensions} = '{}'::jsonb`
        )
      )
      .groupBy(analyticsDailyMetrics.metricName);

    for (const row of payRows) {
      if (row.metricName === "payments_succeeded") paymentHealth.succeeded = Number(row.value) || 0;
      if (row.metricName === "payments_failed") paymentHealth.failed = Number(row.value) || 0;
    }

    const errorToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsErrors)
      .where(
        and(
          eq(analyticsErrors.environment, environment),
          gte(analyticsErrors.occurredAt, todayStart)
        )
      );
    errors.today = errorToday[0]?.count ?? 0;

    const errorPeriod = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsErrors)
      .where(
        and(
          eq(analyticsErrors.environment, environment),
          gte(analyticsErrors.occurredAt, periodStartTs)
        )
      );
    errors.period = errorPeriod[0]?.count ?? 0;

    const errorCatRows = await db
      .select({
        category: analyticsErrors.errorCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsErrors)
      .where(
        and(
          eq(analyticsErrors.environment, environment),
          gte(analyticsErrors.occurredAt, periodStartTs)
        )
      )
      .groupBy(analyticsErrors.errorCategory)
      .orderBy(desc(sql`count(*)`))
      .limit(8);

    errors.byCategory = errorCatRows.map((r) => ({
      category: r.category ?? "uncategorized",
      count: r.count,
    }));

    const errorPlatformRows = await db
      .select({
        platform: analyticsErrors.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsErrors)
      .where(
        and(
          eq(analyticsErrors.environment, environment),
          gte(analyticsErrors.occurredAt, periodStartTs)
        )
      )
      .groupBy(analyticsErrors.platform)
      .orderBy(desc(sql`count(*)`));

    errors.byPlatform = errorPlatformRows.map((r) => ({
      platform: r.platform ?? "unknown",
      count: r.count,
    }));

    const contactRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactSubmissions)
      .where(
        and(
          eq(contactSubmissions.environment, environment),
          gte(contactSubmissions.createdAt, periodStartTs)
        )
      );
    contactSubmissionsPeriod = contactRows[0]?.count ?? 0;
  }

  if (paymentHealth.succeeded + paymentHealth.failed === 0) {
    const todayPayments = store.payments.filter((p) => {
      const ts = (p.completedAt ?? p.createdAt).slice(0, 10);
      return ts === today && !p.isDemo;
    });
    paymentHealth.succeeded = todayPayments.filter((p) => p.status === "completed").length;
    paymentHealth.failed = todayPayments.filter((p) => p.status === "failed").length;
  }

  const totalPay = paymentHealth.succeeded + paymentHealth.failed;
  paymentHealth.successRate = totalPay > 0 ? paymentHealth.succeeded / totalPay : null;

  return {
    environment,
    postgres,
    periodDays,
    computedAt: new Date().toISOString(),
    northStar: {
      paidSeatsToday,
      paidSeatsPeriod,
      trend,
    },
    revenue: {
      gbvToday,
      gbvPeriod,
      byChannel,
    },
    funnel,
    acquisition,
    activeUsersToday,
    paymentHealth,
    topEventsToday,
    errors,
    contactSubmissionsPeriod,
  };
}
