import { isPostgresEnabled } from "@/db/client";
import { listSeoContent, listSeoEntities, searchSeoContent } from "@/lib/seo/queries";
import { analyzeContentGaps } from "@/lib/seo/gaps";
import { apiError, apiOk } from "@/lib/api/responses";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://precifarm.com";

/** MCP-compatible tool manifest for AI agents (Phase 4). */
export async function GET() {
  return apiOk({
    protocol: "precifarm-seo-agent/v1",
    mcpCompatible: true,
    server: {
      name: "precifarm-seo",
      version: "1.0.0",
      description: "Precifarm SEO and knowledge graph agent tools",
    },
    tools: [
      {
        name: "search_content",
        description: "Search published guides, FAQs and articles",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search query" },
            limit: { type: "number", default: 10 },
          },
          required: ["q"],
        },
        endpoint: `${SITE_URL}/api/v1/seo/search?q={q}`,
      },
      {
        name: "get_content",
        description: "Fetch published content by slug",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string" },
            locale: { type: "string", default: "en-KE" },
          },
          required: ["slug"],
        },
        endpoint: `${SITE_URL}/api/v1/seo/content/{slug}?locale={locale}`,
      },
      {
        name: "list_entities",
        description: "List knowledge graph entities",
        inputSchema: {
          type: "object",
          properties: { type: { type: "string", description: "Entity type filter" } },
        },
        endpoint: `${SITE_URL}/api/v1/seo/entities`,
      },
      {
        name: "get_page_knowledge",
        description: "Structured AISO payload for a website path",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", default: "/" } },
        },
        endpoint: `${SITE_URL}/api/knowledge?path={path}`,
      },
      {
        name: "seo_health",
        description: "Run SEO audit on registered pages",
        inputSchema: { type: "object", properties: {} },
        endpoint: `${SITE_URL}/api/seo/health`,
      },
    ],
    resources: [
      { uri: `${SITE_URL}/llms.txt`, name: "LLM discovery file" },
      { uri: `${SITE_URL}/api/knowledge/tools`, name: "Website tool manifest" },
      { uri: `${SITE_URL}/api/v1/seo/agent`, name: "CMS agent RPC" },
    ],
  });
}

/** Execute agent tool by name (simple RPC for MCP-style clients). */
export async function POST(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const b = body as { tool: string; arguments?: Record<string, unknown> };
  const args = b.arguments ?? {};

  switch (b.tool) {
    case "search_content": {
      const q = String(args.q ?? "");
      if (!q.trim()) return apiError("VALIDATION_ERROR", "q required.", 400);
      const limit = Number(args.limit ?? 10);
      const content = await searchSeoContent(q, limit);
      return apiOk({ content });
    }
    case "get_content": {
      const slug = String(args.slug ?? "");
      const locale = String(args.locale ?? "en-KE");
      const { getSeoContentBySlug } = await import("@/lib/seo/queries");
      const content = await getSeoContentBySlug(slug, true, locale);
      if (!content) return apiError("NOT_FOUND", "Content not found.", 404);
      return apiOk({ content });
    }
    case "list_entities": {
      const type = args.type ? String(args.type) : undefined;
      const entities = await listSeoEntities({ type, published: true });
      return apiOk({ entities });
    }
    case "content_gaps": {
      const gaps = await analyzeContentGaps(Number(args.limit ?? 20));
      return apiOk({ gaps });
    }
    case "list_content": {
      const items = await listSeoContent({
        status: "published",
        locale: args.locale ? String(args.locale) : undefined,
        limit: Number(args.limit ?? 50),
      });
      return apiOk({ items });
    }
    default:
      return apiError("UNKNOWN_TOOL", `Unknown tool: ${b.tool}`, 400);
  }
}
