// Every request: answer only on the configured host names, keep signed-out visitors away from the
// agent desk pages, refuse cross-site writes that carry a session cookie, and add security headers.
// The pages and API routes also check the session themselves (including revocation on sign-out);
// this is the first line, so no page renders for a visitor without a validly signed cookie.
import { NextResponse, type NextRequest } from "next/server";
import { signedSessionValid } from "@/lib/security/edge-session";

const SESSION_COOKIES = ["__Host-precifarm_agent_session", "precifarm_agent_session"];
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
/** Pages anyone may open. API routes are excluded here because each route checks its own access. */
const PUBLIC_PAGES = new Set(["/", "/login", "/robots.txt", "/icon.svg"]);

function allowedHosts(): string[] {
  return (process.env.CMS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function secure(res: NextResponse, https: boolean): NextResponse {
  const h = res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "same-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  h.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  h.set("X-Robots-Tag", "noindex, nofollow");
  if (https) h.set("Strict-Transport-Security", "max-age=31536000");
  return res;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const https = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim() === "https";
  const hosts = allowedHosts();
  // The health check answers on any host so platform probes and uptime checks keep working; it
  // reveals only { ok } without an admin session.
  if (hosts.length && !hosts.includes(host) && req.nextUrl.pathname !== "/api/v1/health") {
    return secure(new NextResponse("This CMS does not answer on this address.", { status: 421, headers: { "Content-Type": "text/plain" } }), https);
  }

  const token = SESSION_COOKIES.map((c) => req.cookies.get(c)?.value).find(Boolean);
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/") && !PUBLIC_PAGES.has(path) && !(await signedSessionValid(token, process.env.SESSION_SECRET?.trim()))) {
    const url = new URL("/login", `${https ? "https" : "http"}://${host || "localhost"}`);
    return secure(NextResponse.redirect(url, 307), https);
  }

  if (!SAFE.has(req.method) && token) {
    const origin = req.headers.get("origin");
    let sameSite = true;
    if (origin) {
      try {
        sameSite = new URL(origin).host.toLowerCase() === host;
      } catch {
        sameSite = false;
      }
    }
    if (!sameSite) {
      return secure(NextResponse.json({ error: { code: "FORBIDDEN", message: "Cross-site request refused." } }, { status: 403 }), https);
    }
  }

  return secure(NextResponse.next(), https);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
