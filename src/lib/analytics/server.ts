import crypto from "crypto";
import { CURRENT_SCHEMA_VERSION } from "@/lib/analytics/catalog";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import { insertAnalyticsEvent, logCmsAudit, mergeAnalyticsIdentity } from "@/lib/analytics/ingest";
import type {
  AnalyticsEventInput,
  AnalyticsPlatform,
  BookingAnalyticsContext,
  CmsAuditInput,
  EventPropertyValue,
} from "@/lib/analytics/types";

export type ServerEventContext = Partial<
  Omit<AnalyticsEventInput, "event_id" | "event_name" | "event_properties" | "schema_version">
>;

function channelToPlatform(channel?: string): AnalyticsPlatform {
  if (!channel) return "server";
  if (channel === "web") return "web";
  if (channel === "mobile" || channel === "pwa") return "mobile";
  if (channel.startsWith("agent")) return "cms";
  return "server";
}

/** Fire-and-forget server-side analytics event. Never throws. */
export function trackServerEvent(
  eventName: string,
  properties: Record<string, EventPropertyValue> = {},
  context: ServerEventContext = {}
): void {
  const event: AnalyticsEventInput = {
    event_id: crypto.randomUUID(),
    event_name: eventName,
    schema_version: CURRENT_SCHEMA_VERSION,
    event_timestamp: new Date().toISOString(),
    platform: context.platform ?? "server",
    environment: context.environment ?? getAnalyticsEnvironment(),
    anonymous_id: context.anonymous_id,
    customer_id: context.customer_id,
    session_id: context.session_id,
    app_version: context.app_version,
    device_id: context.device_id,
    page_url: context.page_url,
    screen_name: context.screen_name,
    feature: context.feature,
    object_type: context.object_type,
    object_id: context.object_id,
    request_id: context.request_id,
    booking_id: context.booking_id,
    booking_reference: context.booking_reference,
    event_properties: properties,
    metadata: context.metadata,
  };

  void insertAnalyticsEvent(event);
}

export function trackBookingCreated(input: {
  bookingId: string;
  reference: string;
  customerId: string;
  channel: string;
  routeId: string;
  seatCount: number;
  amountKes: number;
  bookingType: string;
  analytics?: BookingAnalyticsContext;
}): void {
  const platform = channelToPlatform(input.channel);

  trackServerEvent(
    "booking_created",
    {
      channel: input.channel,
      route_id: input.routeId,
      booking_type: input.bookingType,
      seat_count: input.seatCount,
      amount_kes: input.amountKes,
    },
    {
      platform,
      customer_id: input.customerId,
      booking_id: input.bookingId,
      booking_reference: input.reference,
      anonymous_id: input.analytics?.anonymousId,
      session_id: input.analytics?.sessionId,
    }
  );

  if (input.analytics?.anonymousId) {
    void mergeAnalyticsIdentity({
      anonymousId: input.analytics.anonymousId,
      customerId: input.customerId,
      platform,
      acquisition: input.analytics,
    });

    trackServerEvent(
      "identity_merged",
      { channel: input.channel },
      {
        platform,
        anonymous_id: input.analytics.anonymousId,
        customer_id: input.customerId,
        booking_id: input.bookingId,
        booking_reference: input.reference,
      }
    );
  }
}

export function trackBookingPaid(input: {
  bookingId: string;
  reference: string;
  customerId: string;
  channel: string;
  routeId: string;
  seatCount: number;
  amountKes: number;
  bookingType: string;
  method: string;
  isDemo: boolean;
}): void {
  trackServerEvent(
    "booking_paid",
    {
      channel: input.channel,
      route_id: input.routeId,
      booking_type: input.bookingType,
      seat_count: input.seatCount,
      amount_kes: input.amountKes,
      method: input.method,
      is_demo: input.isDemo,
    },
    {
      platform: channelToPlatform(input.channel),
      customer_id: input.customerId,
      booking_id: input.bookingId,
      booking_reference: input.reference,
    }
  );

  trackServerEvent(
    "payment_succeeded",
    {
      channel: input.channel,
      method: input.method,
      amount_kes: input.amountKes,
      is_demo: input.isDemo,
    },
    {
      platform: channelToPlatform(input.channel),
      customer_id: input.customerId,
      booking_id: input.bookingId,
      booking_reference: input.reference,
    }
  );
}

export function trackPaymentInitiated(input: {
  bookingId: string;
  reference: string;
  customerId: string;
  channel: string;
  method: string;
  amountKes: number;
}): void {
  trackServerEvent(
    "payment_initiated",
    {
      channel: input.channel,
      method: input.method,
      amount_kes: input.amountKes,
    },
    {
      platform: channelToPlatform(input.channel),
      customer_id: input.customerId,
      booking_id: input.bookingId,
      booking_reference: input.reference,
    }
  );
}

export function trackPaymentFailed(input: {
  bookingId: string;
  reference: string;
  customerId: string;
  channel: string;
  method: string;
  failureCode?: string;
}): void {
  trackServerEvent(
    "payment_failed",
    {
      channel: input.channel,
      method: input.method,
      failure_code: input.failureCode ?? "unknown",
    },
    {
      platform: channelToPlatform(input.channel),
      customer_id: input.customerId,
      booking_id: input.bookingId,
      booking_reference: input.reference,
    }
  );
}

export function trackCmsAudit(input: CmsAuditInput): void {
  void logCmsAudit(input);
}

export { channelToPlatform };
