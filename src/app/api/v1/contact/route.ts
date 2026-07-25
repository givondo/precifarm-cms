import { getDb, isPostgresEnabled } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import { insertAnalyticsEvent } from "@/lib/analytics/ingest";
import { getClientIp, checkRateLimit } from "@/lib/api/rate-limit";
import { apiError, apiOk } from "@/lib/api/responses";
import { validateContactInput } from "@/lib/contact";

const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError(
      "CONTACT_UNAVAILABLE",
      "Contact form requires PostgreSQL. Try email or phone instead.",
      503
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip, CONTACT_LIMIT, CONTACT_WINDOW_MS)) {
    return apiError("RATE_LIMITED", "Too many contact submissions. Try again shortly.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const validated = validateContactInput(body);
  if (!validated.ok) {
    return apiError("VALIDATION_ERROR", validated.error, 400);
  }

  const { input } = validated;
  const environment = getAnalyticsEnvironment();
  const db = getDb();

  const [row] = await db
    .insert(contactSubmissions)
    .values({
      name: input.name,
      email: input.email,
      phone: input.phone,
      interest: input.interest,
      message: input.message,
      channel: input.channel ?? "web",
      anonymousId: input.anonymousId,
      environment,
    })
    .returning({ id: contactSubmissions.id });

  await insertAnalyticsEvent({
    event_id: crypto.randomUUID(),
    event_name: "website_contact_submitted",
    schema_version: 1,
    event_timestamp: new Date().toISOString(),
    anonymous_id: input.anonymousId,
    platform: "web",
    environment,
    event_properties: {
      interest: input.interest,
      channel: input.channel ?? "web",
      submission_id: row.id,
    },
  });

  return apiOk({ id: row.id, received: true }, 201);
}
