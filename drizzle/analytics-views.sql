-- Precifarm analytics views (Phase 4). Run: npm run analytics:views

CREATE OR REPLACE VIEW vw_analytics_event_counts_daily AS
SELECT
  (event_timestamp AT TIME ZONE 'UTC')::date AS metric_date,
  environment,
  platform,
  event_name,
  COUNT(*)::bigint AS event_count
FROM analytics_events
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW vw_daily_active_users AS
SELECT
  (event_timestamp AT TIME ZONE 'UTC')::date AS metric_date,
  environment,
  COUNT(DISTINCT COALESCE(customer_id, anonymous_id))::bigint AS active_users
FROM analytics_events
GROUP BY 1, 2;

CREATE OR REPLACE VIEW vw_paid_seats_daily AS
SELECT
  metric_date,
  environment,
  metric_value::numeric AS paid_seats
FROM analytics_daily_metrics
WHERE metric_name = 'paid_seats'
  AND dimensions = '{}'::jsonb;

CREATE OR REPLACE VIEW vw_revenue_daily AS
SELECT
  metric_date,
  environment,
  metric_value::numeric AS gbv
FROM analytics_daily_metrics
WHERE metric_name = 'gbv'
  AND dimensions = '{}'::jsonb;

CREATE OR REPLACE VIEW vw_payment_funnel AS
SELECT
  environment,
  event_name,
  COUNT(*)::bigint AS event_count
FROM analytics_events
WHERE event_name IN (
  'payment_initiated',
  'payment_succeeded',
  'payment_failed',
  'website_payment_started',
  'website_payment_succeeded',
  'website_payment_failed'
)
GROUP BY 1, 2;

CREATE OR REPLACE VIEW vw_acquisition_by_source AS
SELECT
  COALESCE(first_touch_source, 'direct') AS source,
  COALESCE(first_touch_medium, 'none') AS medium,
  COUNT(*)::bigint AS identity_count
FROM analytics_acquisition
GROUP BY 1, 2;

CREATE OR REPLACE VIEW vw_website_funnel AS
SELECT
  environment,
  event_name,
  COUNT(*)::bigint AS event_count
FROM analytics_events
WHERE platform = 'web'
  AND event_name LIKE 'website_%'
GROUP BY 1, 2;

CREATE OR REPLACE VIEW vw_error_event_summary AS
SELECT
  (occurred_at AT TIME ZONE 'UTC')::date AS metric_date,
  environment,
  error_category,
  COUNT(*)::bigint AS error_count
FROM analytics_errors
GROUP BY 1, 2, 3;
