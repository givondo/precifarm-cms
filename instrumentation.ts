export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logEnvOnStartup } = await import("@/lib/env-log");
    logEnvOnStartup();
  }
}
