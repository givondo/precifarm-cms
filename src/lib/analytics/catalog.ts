/** P0 + server events allowed through ingest (schema v1). */
export const ALLOWED_EVENT_NAMES = new Set([
  // Website
  "website_session_started",
  "website_page_viewed",
  "website_utm_captured",
  "website_referrer_captured",
  "website_booking_search_submitted",
  "website_booking_seats_selected",
  "website_booking_details_submitted",
  "website_booking_created",
  "website_booking_failed",
  "website_payment_started",
  "website_payment_pending",
  "website_payment_succeeded",
  "website_payment_failed",
  "website_booking_abandoned",
  "website_app_download_clicked",
  "website_cta_clicked",
  "website_contact_submitted",
  // Mobile
  "mobile_app_opened",
  "mobile_session_started",
  "mobile_search_submitted",
  "mobile_trip_selected",
  "mobile_seats_selected",
  "mobile_booking_started",
  "mobile_booking_completed",
  "mobile_payment_pending",
  "mobile_payment_failed",
  "mobile_screen_viewed",
  "mobile_api_request_failed",
  "mobile_track_lookup_started",
  "mobile_track_lookup_failed",
  "mobile_quick_action_tapped",
  "cargo_started",
  "cargo_confirmed",
  // Legacy mobile names (30-day migration)
  "search_buses",
  "booking_started",
  "booking_confirmed",
  "payment_pending",
  "payment_failed",
  "track_lookup",
  "track_not_found",
  "quick_action",
  "screen_view",
  "api_error",
  // Server / transactional complement
  "booking_created",
  "booking_paid",
  "payment_initiated",
  "payment_pending",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "identity_merged",
  "identity_anonymous_created",
  // CMS admin
  "cms_login_succeeded",
  "cms_login_failed",
  "cms_logout",
  // Engineering
  "api_request_failed",
  "database_connection_failed",
  "analytics_ingest_rejected",
]);

export const CURRENT_SCHEMA_VERSION = 1;

export function isAllowedEventName(name: string): boolean {
  return ALLOWED_EVENT_NAMES.has(name);
}
