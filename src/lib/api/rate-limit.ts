/** In-memory, per-instance fixed-window limiter. Keys should be namespaced, e.g. `stk:${ip}`. */
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

function pruneExpired(now: number) {
  for (const [key, entry] of rateLimit) {
    if (entry.resetAt < now) rateLimit.delete(key);
  }
}

/** True when the key has used its allowance in the current window, without counting this call. */
export function rateLimited(key: string, limit: number): boolean {
  const entry = rateLimit.get(key);
  return !!entry && entry.resetAt >= Date.now() && entry.count >= limit;
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
 * Client IP for rate limiting.
 *
 * x-nf-client-connection-ip is only trusted when running on Netlify (NETLIFY is set),
 * where the edge overwrites it. Anywhere else, including Cloud Run, a client can send
 * that header with any value, so it is ignored.
 *
 * Otherwise the right-most X-Forwarded-For entry is used. On Cloud Run with direct
 * domain mapping the Google front end appends the real client address as the last
 * entry, and everything to its left is client supplied and trivially spoofed. Behind
 * an external HTTPS load balancer the load balancer appends its own entries, so the
 * right-most entry would no longer be the client and this function must be revisited.
 */
export function getClientIp(request: Request): string {
  if (process.env.NETLIFY) {
    const netlify = request.headers.get("x-nf-client-connection-ip");
    if (netlify) return netlify.trim();
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
