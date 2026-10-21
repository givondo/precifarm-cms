// Session signature check for the middleware, which runs without Node's crypto module: Web Crypto
// only. It checks the HMAC and expiry; revocation is checked by the pages and routes (src/lib/auth.ts).
const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Signature and expiry of a session token (format from src/lib/security/session.ts). */
export async function signedSessionValid(token: string | undefined, secret: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token || token.length > 1024) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  if (!secret || secret.length < 32) return process.env.NODE_ENV !== "production"; // dev uses a per-process secret
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlBytes(parts[1]), new TextEncoder().encode(parts[0]));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0]))) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp * 1000 > nowMs;
  } catch {
    return false;
  }
}
