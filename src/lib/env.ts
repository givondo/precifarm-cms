/**
 * Central environment config — load secrets from `.env` (never commit that file).
 * Copy `.env.example` → `.env` and fill in live values for production.
 */

import { isDatabaseConfigured } from "@/lib/database-url";

export type MpesaEnvironment = "sandbox" | "production";

function trim(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** M-Pesa Daraja credentials (server-only). */
export const mpesaEnv = {
  consumerKey: trim("MPESA_CONSUMER_KEY"),
  consumerSecret: trim("MPESA_CONSUMER_SECRET"),
  passkey: trim("MPESA_PASSKEY"),
  shortcode: trim("MPESA_SHORTCODE"),
  callbackUrl: trim("MPESA_CALLBACK_URL"),
  environment: (trim("MPESA_ENVIRONMENT") ?? "sandbox") as MpesaEnvironment,
} as const;

export const appEnv = {
  /** Explicit demo flag. Live STK requires `false` + full M-Pesa credentials. */
  demoPayment: trim("DEMO_PAYMENT") !== "false",
  databaseUrl: trim("DATABASE_URL"),
  nodeEnv: trim("NODE_ENV") ?? "development",
} as const;

export function hasMpesaCredentials(): boolean {
  const { consumerKey, consumerSecret, passkey, shortcode, callbackUrl } = mpesaEnv;
  return !!(consumerKey && consumerSecret && passkey && shortcode && callbackUrl);
}

/** True when CMS simulates M-Pesa (no STK push, no charge). */
export function isDemoPayment(): boolean {
  if (!appEnv.demoPayment && hasMpesaCredentials()) {
    return false;
  }
  return true;
}

export type PaymentMode = "demo" | "live-sandbox" | "live-production" | "misconfigured";

export function getPaymentMode(): PaymentMode {
  if (isDemoPayment()) {
    return "demo";
  }
  if (!hasMpesaCredentials()) {
    return "misconfigured";
  }
  return mpesaEnv.environment === "production" ? "live-production" : "live-sandbox";
}

/** Daraja API base URL for current M-Pesa environment. */
export function mpesaApiBaseUrl(): string {
  return mpesaEnv.environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/** Non-secret summary for logs and health checks. */
export function envSummary() {
  const mode = getPaymentMode();
  return {
    paymentMode: mode,
    mpesaEnvironment: mpesaEnv.environment,
    hasConsumerKey: !!mpesaEnv.consumerKey,
    hasConsumerSecret: !!mpesaEnv.consumerSecret,
    hasPasskey: !!mpesaEnv.passkey,
    hasShortcode: !!mpesaEnv.shortcode,
    callbackHost: mpesaEnv.callbackUrl ? safeHost(mpesaEnv.callbackUrl) : null,
    databaseConfigured: isDatabaseConfigured(),
    storageBackend: isDatabaseConfigured() ? "postgresql" : "json-file",
  };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
