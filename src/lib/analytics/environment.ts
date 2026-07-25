import type { AnalyticsEnvironment } from "@/lib/analytics/types";

function trim(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Resolve analytics environment — never default to production. */
export function getAnalyticsEnvironment(): AnalyticsEnvironment {
  const explicit = trim("ANALYTICS_ENVIRONMENT") ?? trim("VERCEL_ENV") ?? trim("NETLIFY_CONTEXT");
  if (explicit === "production") return "production";
  if (explicit === "staging" || explicit === "deploy-preview") return "staging";
  if (process.env.NODE_ENV === "production") {
    // Netlify/Vercel production deploy without explicit flag
    if (trim("NETLIFY") === "true" || trim("VERCEL") === "1") return "production";
  }
  return "development";
}

export function isAnalyticsIngestEnabled(): boolean {
  return trim("ANALYTICS_INGEST_ENABLED") !== "false";
}

export function getAnalyticsIngestKey(): string | undefined {
  return trim("ANALYTICS_INGEST_KEY");
}
