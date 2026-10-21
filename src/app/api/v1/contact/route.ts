import { getDb, isPostgresEnabled } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import { insertAnalyticsEvent } from "@/lib/analytics/ingest";
import { getClientIp, checkRateLimit } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { apiError, apiOk } from "@/lib/api/responses";
import { validateContactInput } from "@/lib/contact";
import { createInstallSurveyFromLead } from "@/lib/services";

const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 60_000;
const CONTACT_MAX_BYTES = 32 * 1024;

export async function POST(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError(
      "CONTACT_UNAVAILABLE",
      "Contact form requires PostgreSQL. Try email or phone instead.",
      503
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`contact:${ip}`, CONTACT_LIMIT, CONTACT_WINDOW_MS)) {
    return apiError("RATE_LIMITED", "Too many contact submissions. Try again shortly.", 429);
  }

  const read = await readJsonBody(request, CONTACT_MAX_BYTES);
  if (!read.ok) return read.response;

  const validated = validateContactInput(read.body);
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
      // contact_submissions.channel is varchar(16); longer tags (web-private-house) would fail the insert.
      channel: (input.channel ?? "web").slice(0, 16),
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

  const install = await createInstallSurveyFromLead({
    ...input,
    contactSubmissionId: row.id,
  });

  const installOrder = !install.skipped
    ? {
        reference: install.reference,
        product: install.product,
        stage: install.stage,
      }
    : install.reason === "duplicate_today"
      ? { reference: install.reference, duplicate: true }
      : null;

  return apiOk({ id: row.id, received: true, installOrder }, 201);
}
