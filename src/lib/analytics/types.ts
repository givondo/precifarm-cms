export type AnalyticsPlatform = "web" | "mobile" | "cms" | "server";
export type AnalyticsEnvironment = "development" | "staging" | "production";

export type EventPropertyValue = string | number | boolean | null;

export type AnalyticsEventInput = {
  event_id: string;
  event_name: string;
  schema_version?: number;
  event_timestamp: string;
  anonymous_id?: string;
  customer_id?: string;
  session_id?: string;
  platform: AnalyticsPlatform;
  environment?: AnalyticsEnvironment;
  app_version?: string;
  device_id?: string;
  page_url?: string;
  screen_name?: string;
  feature?: string;
  object_type?: string;
  object_id?: string;
  request_id?: string;
  booking_id?: string;
  booking_reference?: string;
  event_properties?: Record<string, EventPropertyValue>;
  metadata?: Record<string, unknown>;
};

export type BookingAnalyticsContext = {
  anonymousId?: string;
  sessionId?: string;
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
  acquisitionTerm?: string;
  acquisitionContent?: string;
};

export type CmsAuditInput = {
  actorId: string;
  actorRole?: string;
  action: string;
  objectType?: string;
  objectId?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
};
