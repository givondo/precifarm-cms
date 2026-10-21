import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Agent desk session lifetime (8 hours). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionPayload = {
  /** Agent id. */
  sub: string;
  /** Expiry, seconds since epoch. */
  exp: number;
  /** Issue time, seconds since epoch. */
  iat?: number;
  /** Issue time in milliseconds; compared with the agent's sessionsNotBefore. */
  iatMs?: number;
};

type GlobalWithDevSecret = typeof globalThis & { __precifarmDevSessionSecret?: string };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * HMAC key for session cookies. Production requires SESSION_SECRET (min 32 chars)
 * and fails closed (returns null) without it. Development falls back to a random
 * per-process secret so local logins work without configuration.
 */
export function getSessionSecret(): string | null {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (isProduction()) {
    if (configured) console.error("[auth] SESSION_SECRET is shorter than 32 characters; sessions disabled.");
    else console.error("[auth] SESSION_SECRET is not set; sessions disabled.");
    return null;
  }
  const g = globalThis as GlobalWithDevSecret;
  if (!g.__precifarmDevSessionSecret) {
    g.__precifarmDevSessionSecret = randomBytes(32).toString("hex");
    console.warn("[auth] SESSION_SECRET not set; using a random development secret for this process.");
  }
  return g.__precifarmDevSessionSecret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Encodes `{sub, exp}` as `base64url(json).base64url(hmac)`. */
export function signSessionToken(
  agentId: string,
  secret: string,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
  nowMs = Date.now()
): string {
  const payload: SessionPayload = {
    sub: agentId,
    exp: Math.floor(nowMs / 1000) + maxAgeSeconds,
    iat: Math.floor(nowMs / 1000),
    iatMs: nowMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

/** Returns the payload when the signature is valid and the token has not expired. */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now()
): SessionPayload | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded, secret), "base64url");
  const provided = Buffer.from(signature, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as SessionPayload).sub !== "string" ||
    typeof (payload as SessionPayload).exp !== "number"
  ) {
    return null;
  }
  const { sub, exp, iat, iatMs } = payload as SessionPayload;
  if (!sub || exp * 1000 <= nowMs) return null;
  const out: SessionPayload = { sub, exp };
  if (typeof iat === "number") out.iat = iat;
  if (typeof iatMs === "number") out.iatMs = iatMs;
  return out;
}

/** Cookie attributes for the agent session cookie. */
export function sessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
