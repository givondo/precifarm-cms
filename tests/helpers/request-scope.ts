// Runs code inside a minimal Next.js request scope, so server code that calls cookies() from
// next/headers (src/lib/auth.ts) can be exercised directly from a unit test.
import { AsyncLocalStorage } from "node:async_hooks";

const g = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage };
// Next.js reads this global when its storage modules first load; the Node runtime sets it in a real server.
if (!g.AsyncLocalStorage) g.AsyncLocalStorage = AsyncLocalStorage;

const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external.js");
const { RequestCookiesAdapter } = await import("next/dist/server/web/spec-extension/adapters/request-cookies.js");
const { RequestCookies } = await import("next/dist/server/web/spec-extension/cookies.js");

/** Calls fn as if serving a request that carries the given cookies. */
export function withRequestCookies<T>(cookies: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const header = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const sealed = RequestCookiesAdapter.seal(new RequestCookies(new Headers(header ? { cookie: header } : {})));
  const workStore = { route: "/unit-test", forceStatic: false, dynamicShouldError: false, isStaticGeneration: false };
  const requestStore = { type: "request", phase: "render", cookies: sealed, userspaceMutableCookies: sealed };
  return workAsyncStorage.run(workStore as never, () => workUnitAsyncStorage.run(requestStore as never, fn));
}
