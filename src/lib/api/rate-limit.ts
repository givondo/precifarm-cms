/** In-memory, per-instance fixed-window limiter. Keys should be namespaced, e.g. `stk:${ip}`. */
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

function pruneExpired(now: number) {
  for (const [key, entry] of rateLimit) {
    if (entry.resetAt < now) rateLimit.delete(key);
  }
}

export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  if (rateLimit.size > MAX_KEYS) pruneExpired(now);
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Client IP for rate limiting. Uses the platform header on Netlify, otherwise the
 * right-most X-Forwarded-For entry (appended by the Cloud Run front end), because
 * left-most entries are client-supplied and trivially spoofed.
 */
export function getClientIp(request: Request): string {
  const netlify = request.headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
