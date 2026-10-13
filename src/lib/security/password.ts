import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt cost parameters for new hashes. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Upper bounds when reading stored hashes, so a corrupted record cannot exhaust memory. */
const MAX_N = 1 << 17;
const MAX_R = 16;
const MAX_P = 4;

function scryptKey(password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) {
  return scryptSync(password.normalize("NFKC"), salt, keyLength, {
    N: n,
    r,
    p,
    maxmem: 256 * n * r * p,
  });
}

/** Returns `scrypt$N$r$p$saltB64$hashB64`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export function isPasswordHash(stored: string | undefined | null): boolean {
  return typeof stored === "string" && stored.startsWith("scrypt$");
}

export function legacyPlaintextAllowed(): boolean {
  return process.env.ALLOW_LEGACY_PLAINTEXT?.trim().toLowerCase() === "true";
}

function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(n) || n < 2 || n > MAX_N || (n & (n - 1)) !== 0 ||
    !Number.isInteger(r) || r < 1 || r > MAX_R ||
    !Number.isInteger(p) || p < 1 || p > MAX_P
  ) {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length < 16) return false;
  const actual = scryptKey(password, salt, n, r, p, expected.length);
  return timingSafeEqual(actual, expected);
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a, "utf8").digest();
  const db = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(da, db);
}

export type PasswordCheck = { ok: boolean; needsUpgrade: boolean };

/**
 * Verifies a password against a stored scrypt hash. A legacy plaintext value is
 * accepted only when ALLOW_LEGACY_PLAINTEXT=true, and is then flagged for upgrade.
 */
export function verifyPassword(password: string, stored: string | undefined | null): PasswordCheck {
  if (typeof stored !== "string" || stored.length === 0) return { ok: false, needsUpgrade: false };
  if (isPasswordHash(stored)) {
    return { ok: verifyScrypt(password, stored), needsUpgrade: false };
  }
  if (!legacyPlaintextAllowed()) {
    return { ok: false, needsUpgrade: false };
  }
  const ok = constantTimeStringEqual(password, stored);
  return { ok, needsUpgrade: ok };
}

/** A fixed hash used to spend comparable time when the account does not exist. */
let dummyHash: string | null = null;
export function burnPasswordCheck(password: string): void {
  if (!dummyHash) dummyHash = hashPassword(randomBytes(16).toString("hex"));
  verifyScrypt(password, dummyHash);
}

const seedPasswordCache = new Map<string, string>();

/**
 * Plaintext password for a seeded account. Reads the given env var; when unset,
 * generates a random password once per process and prints it to the console
 * outside production only. Never hardcoded.
 */
export function resolveSeedPassword(envName: string, label: string): string {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  const cached = seedPasswordCache.get(envName);
  if (cached) return cached;
  const generated = randomBytes(12).toString("base64url");
  seedPasswordCache.set(envName, generated);
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[seed] ${envName} not set. Generated ${label} password (shown once): ${generated}`);
  }
  return generated;
}
