import { getClientIp, checkRateLimit } from "@/lib/api/rate-limit";
import { apiError, apiOk } from "@/lib/api/responses";
import { validateContactInput } from "@/lib/contact";
import { createInstallSurveyFromLead } from "@/lib/services";

const SURVEY_LIMIT = 5;
const SURVEY_WINDOW_MS = 60_000;

/** Public intake for home-charger survey leads (website, PWA). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`install-survey:${ip}`, SURVEY_LIMIT, SURVEY_WINDOW_MS)) {
    return apiError("RATE_LIMITED", "Too many survey requests. Try again shortly.", 429);
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
