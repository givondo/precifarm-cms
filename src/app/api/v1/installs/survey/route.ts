import { getClientIp, checkRateLimit, rateLimited } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";
import { apiError, apiOk } from "@/lib/api/responses";
import { normalizeKenyanPhone } from "@/lib/booking";
import { validateContactInput } from "@/lib/contact";
import { createInstallSurveyFromLead } from "@/lib/services";

const SURVEY_LIMIT = 5;
const SURVEY_WINDOW_MS = 60_000;
/** Overall cap on saved surveys across all addresses: each one rewrites the store, so floods stop early. Rejected requests do not count, so junk cannot block real enquiries. */
const SURVEY_GLOBAL_LIMIT = 60;
const SURVEY_GLOBAL_WINDOW_MS = 60 * 60_000;
/** The largest valid survey (5000 character message plus contact fields) is well under this. */
const SURVEY_MAX_BYTES = 32 * 1024;

/** Public intake for home-charger survey leads (website, PWA). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`install-survey:${ip}`, SURVEY_LIMIT, SURVEY_WINDOW_MS) || rateLimited("install-survey:all", SURVEY_GLOBAL_LIMIT)) {
    return apiError("RATE_LIMITED", "Too many survey requests. Try again shortly.", 429);
  }

  const read = await readJsonBody(request, SURVEY_MAX_BYTES);
  if (!read.ok) return read.response;

  const validated = validateContactInput(read.body);
  if (!validated.ok) {
    return apiError("VALIDATION_ERROR", validated.error, 400);
  }
  // The installation team calls this number and Lipa Pole Pole runs on it, so it must be a Kenyan mobile.
  if (!validated.input.phone || !normalizeKenyanPhone(validated.input.phone)) {
    return apiError("VALIDATION_ERROR", "Enter a valid Kenyan phone number (e.g. 07XX XXX XXX).", 400);
  }

  checkRateLimit("install-survey:all", SURVEY_GLOBAL_LIMIT, SURVEY_GLOBAL_WINDOW_MS);
  const result = await createInstallSurveyFromLead(validated.input);
  if (result.skipped && result.reason === "not_home_charging") {
    return apiOk({ received: true, installOrder: null }, 201);
  }

  if (result.skipped) {
    return apiOk(
      {
        received: true,
        installOrder: {
          reference: result.reference,
          duplicate: true,
        },
      },
      201,
    );
  }

  return apiOk(
    {
      received: true,
      installOrder: {
        id: result.id,
        reference: result.reference,
        product: result.product,
        stage: result.stage,
      },
    },
    201,
  );
}
