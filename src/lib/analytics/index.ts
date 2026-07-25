export type {
  AnalyticsEventInput,
  AnalyticsEnvironment,
  AnalyticsPlatform,
  BookingAnalyticsContext,
  CmsAuditInput,
} from "@/lib/analytics/types";

export { ALLOWED_EVENT_NAMES, CURRENT_SCHEMA_VERSION, isAllowedEventName } from "@/lib/analytics/catalog";
export { getAnalyticsEnvironment, getAnalyticsIngestKey, isAnalyticsIngestEnabled } from "@/lib/analytics/environment";
export {
  getAnalyticsIngestStatus,
  insertAnalyticsEvent,
  insertAnalyticsEvents,
  logCmsAudit,
  mergeAnalyticsIdentity,
} from "@/lib/analytics/ingest";
export { insertAnalyticsError, insertAnalyticsErrors } from "@/lib/analytics/errors";
export {
  validateAnalyticsError,
  validateAnalyticsErrorBatch,
} from "@/lib/analytics/error-validate";
export type { AnalyticsErrorInput } from "@/lib/analytics/error-validate";
export {
  trackBookingCreated,
  trackBookingPaid,
  trackCmsAudit,
  trackPaymentFailed,
  trackPaymentInitiated,
  trackServerEvent,
} from "@/lib/analytics/server";
export { validateAnalyticsBatch, validateAnalyticsEvent } from "@/lib/analytics/validate";
export {
  aggregateDailyRange,
  computeDailyMetrics,
  persistDailyMetrics,
} from "@/lib/analytics/aggregate-daily";
export { getAnalyticsDashboard } from "@/lib/analytics/dashboard";
export type { AnalyticsDashboardData } from "@/lib/analytics/dashboard";
