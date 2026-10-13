import { createHash, timingSafeEqual } from "node:crypto";

/** True when callbacks must be authenticated (Node production or live Daraja production). */
export function isProductionPayments(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.MPESA_ENVIRONMENT?.trim() === "production"
  );
}

export function getCallbackToken(): string | undefined {
  const token = process.env.MPESA_CALLBACK_TOKEN?.trim();
  return token || undefined;
}

/** Appends the shared callback token as a `token` query parameter. */
export function buildCallbackUrl(baseUrl: string, token: string | undefined): string {
  if (!token) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function tokensMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function getAllowedCallbackIps(): string[] {
  return (process.env.MPESA_CALLBACK_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/**
 * Caller IP for the allowlist. Uses the right-most X-Forwarded-For entry, which is
 * appended by the platform proxy (Cloud Run front end) and cannot be set by the client.
 */
export function callbackCallerIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

export type CallbackAuthResult = { ok: true } | { ok: false; status: number; reason: string };

/** Validates the shared token (and optional IP allowlist) on an incoming M-Pesa callback. */
export function authorizeMpesaCallback(request: Request): CallbackAuthResult {
  const expected = getCallbackToken();
  if (!expected) {
    if (isProductionPayments()) {
      return { ok: false, status: 503, reason: "Callback token not configured." };
    }
    console.warn("[mpesa] MPESA_CALLBACK_TOKEN not set; accepting unauthenticated callback (development only).");
  } else {
    const provided = new URL(request.url).searchParams.get("token");
    if (!tokensMatch(provided, expected)) {
      return { ok: false, status: 401, reason: "Unauthorised callback." };
    }
  }

  const allowed = getAllowedCallbackIps();
  if (allowed.length > 0) {
    const ip = callbackCallerIp(request);
    if (!ip || !allowed.includes(ip)) {
      return { ok: false, status: 403, reason: "Callback source not allowed." };
    }
  }
  return { ok: true };
}
