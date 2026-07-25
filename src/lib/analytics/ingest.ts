import { getDb, isPostgresEnabled } from "@/db/client";
import {
  analyticsAcquisition,
  analyticsAuditLog,
  analyticsEvents,
  analyticsIdentity,
} from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import type {
  AnalyticsEventInput,
  BookingAnalyticsContext,
  CmsAuditInput,
} from "@/lib/analytics/types";
import type { AnalyticsPlatform } from "@/lib/analytics/types";

function resolveEnvironment(input?: AnalyticsEventInput["environment"]) {
  return input ?? getAnalyticsEnvironment();
}

export async function insertAnalyticsEvent(event: AnalyticsEventInput): Promise<boolean> {
  if (!isPostgresEnabled()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[analytics]", event.event_name, event.event_properties);
    }
    return false;
  }

  try {
    const db = getDb();
    await db
      .insert(analyticsEvents)
      .values({
        eventId: event.event_id,
        eventName: event.event_name,
        schemaVersion: event.schema_version ?? 1,
        eventTimestamp: new Date(event.event_timestamp),
        anonymousId: event.anonymous_id,
        customerId: event.customer_id,
        sessionId: event.session_id,
        platform: event.platform,
        environment: resolveEnvironment(event.environment),
        appVersion: event.app_version,
        deviceId: event.device_id,
        pageUrl: event.page_url,
        screenName: event.screen_name,
        feature: event.feature,
        objectType: event.object_type,
        objectId: event.object_id,
        requestId: event.request_id,
        bookingId: event.booking_id,
        bookingReference: event.booking_reference,
        eventProperties: event.event_properties ?? {},
        metadata: event.metadata ?? null,
      })
      .onConflictDoNothing({ target: analyticsEvents.eventId });

    return true;
  } catch (err) {
    console.error("[analytics] insert failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function insertAnalyticsEvents(events: AnalyticsEventInput[]): Promise<number> {
  let inserted = 0;
  for (const event of events) {
    if (await insertAnalyticsEvent(event)) inserted++;
  }
  return inserted;
}

export async function mergeAnalyticsIdentity(input: {
  anonymousId: string;
  customerId: string;
  platform?: AnalyticsPlatform;
  acquisition?: BookingAnalyticsContext;
}): Promise<void> {
  if (!isPostgresEnabled()) return;

  try {
    const db = getDb();
    const now = new Date();

    await db
      .insert(analyticsIdentity)
      .values({
        anonymousId: input.anonymousId,
        customerId: input.customerId,
        mergedAt: now,
        platform: input.platform,
      })
      .onConflictDoUpdate({
        target: analyticsIdentity.anonymousId,
        set: {
          customerId: input.customerId,
          mergedAt: now,
          platform: input.platform,
        },
      });

    if (input.acquisition?.acquisitionSource || input.acquisition?.acquisitionMedium) {
      const acq = input.acquisition;
      await db
        .insert(analyticsAcquisition)
        .values({
          anonymousId: input.anonymousId,
          firstTouchSource: acq.acquisitionSource,
          firstTouchMedium: acq.acquisitionMedium,
          firstTouchCampaign: acq.acquisitionCampaign,
          firstTouchTerm: acq.acquisitionTerm,
          firstTouchContent: acq.acquisitionContent,
          firstTouchAt: now,
          lastTouchSource: acq.acquisitionSource,
          lastTouchMedium: acq.acquisitionMedium,
          lastTouchCampaign: acq.acquisitionCampaign,
          lastTouchAt: now,
        })
        .onConflictDoUpdate({
          target: analyticsAcquisition.anonymousId,
          set: {
            lastTouchSource: acq.acquisitionSource,
            lastTouchMedium: acq.acquisitionMedium,
            lastTouchCampaign: acq.acquisitionCampaign,
            lastTouchAt: now,
          },
        });
    }
  } catch (err) {
    console.error("[analytics] identity merge failed:", err instanceof Error ? err.message : err);
  }
}

export async function logCmsAudit(input: CmsAuditInput): Promise<void> {
  if (!isPostgresEnabled()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[cms-audit]", input.action, input.objectType, input.objectId);
    }
    return;
  }

  try {
    const db = getDb();
    await db.insert(analyticsAuditLog).values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      success: input.success ?? true,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error("[cms-audit] insert failed:", err instanceof Error ? err.message : err);
  }
}

export async function getAnalyticsIngestStatus(): Promise<{
  enabled: boolean;
  postgres: boolean;
  environment: string;
}> {
  return {
    enabled: isPostgresEnabled(),
    postgres: isPostgresEnabled(),
    environment: getAnalyticsEnvironment(),
  };
}
