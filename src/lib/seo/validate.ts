import type { SeoContentType, SeoContentStatus, SeoReviewStatus, SeoSource } from "@/lib/seo/types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_TYPES: SeoContentType[] = ["guide", "faq", "article", "howto", "local_page"];
const STATUSES: SeoContentStatus[] = ["draft", "published", "archived"];
const REVIEW_STATUSES: SeoReviewStatus[] = ["pending_review", "approved", "rejected"];

export function validateSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 160;
}

function parseSources(value: unknown): SeoSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const s = item as Record<string, unknown>;
      return {
        title: String(s.title ?? ""),
        url: String(s.url ?? ""),
        accessedAt: s.accessedAt ? String(s.accessedAt) : undefined,
      };
    })
    .filter((s) => s.title && s.url);
}

export function validateContentInput(body: unknown):
  | { ok: true; input: ContentInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be an object." };
  }

  const b = body as Record<string, unknown>;
  const slug = String(b.slug ?? "").trim();
  const title = String(b.title ?? "").trim();
  const description = String(b.description ?? "").trim();
  const contentType = String(b.contentType ?? "guide") as SeoContentType;
  const status = String(b.status ?? "draft") as SeoContentStatus;
  const reviewStatus = b.reviewStatus ? (String(b.reviewStatus) as SeoReviewStatus) : null;
  const locale = String(b.locale ?? "en-KE").trim();

  if (!validateSlug(slug)) return { ok: false, error: "Invalid slug." };
  if (title.length < 3) return { ok: false, error: "Title too short." };
  if (description.length < 20) return { ok: false, error: "Description too short." };
  if (!CONTENT_TYPES.includes(contentType)) return { ok: false, error: "Invalid content type." };
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  if (reviewStatus && !REVIEW_STATUSES.includes(reviewStatus)) {
    return { ok: false, error: "Invalid review status." };
  }

  return {
    ok: true,
    input: {
      slug,
      locale,
      title,
      description,
      bodyMd: b.bodyMd ? String(b.bodyMd) : null,
      contentType,
      status,
      entityIds: Array.isArray(b.entityIds) ? (b.entityIds as string[]) : [],
      aisoBlocks: Array.isArray(b.aisoBlocks) ? b.aisoBlocks : [],
      authorName: b.authorName ? String(b.authorName) : null,
      reviewerName: b.reviewerName ? String(b.reviewerName) : null,
      reviewStatus,
      reviewNotes: b.reviewNotes ? String(b.reviewNotes) : null,
      aiGenerated: b.aiGenerated === true,
      generationMetadata:
        b.generationMetadata && typeof b.generationMetadata === "object"
          ? (b.generationMetadata as Record<string, unknown>)
          : null,
      sources: parseSources(b.sources),
      publishedAt: status === "published" ? new Date() : null,
    },
  };
}

export type ContentInput = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  bodyMd: string | null;
  contentType: SeoContentType;
  status: SeoContentStatus;
  entityIds: string[];
  aisoBlocks: unknown[];
  authorName: string | null;
  reviewerName: string | null;
  reviewStatus: SeoReviewStatus | null;
  reviewNotes: string | null;
  aiGenerated: boolean;
  generationMetadata: Record<string, unknown> | null;
  sources: SeoSource[];
  publishedAt: Date | null;
};

export function validateEntityInput(body: unknown):
  | { ok: true; input: EntityInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be an object." };
  }

  const b = body as Record<string, unknown>;
  const slug = String(b.slug ?? "").trim();
  const name = String(b.name ?? "").trim();
  const type = String(b.type ?? "").trim();
  const description = String(b.description ?? "").trim();

  if (!validateSlug(slug)) return { ok: false, error: "Invalid slug." };
  if (!name) return { ok: false, error: "Name required." };
  if (!type) return { ok: false, error: "Type required." };
  if (description.length < 10) return { ok: false, error: "Description too short." };

  return {
    ok: true,
    input: {
      slug,
      name,
      type,
      description,
      url: b.url ? String(b.url) : null,
      aliases: Array.isArray(b.aliases) ? (b.aliases as string[]) : [],
      metadata: b.metadata && typeof b.metadata === "object" ? (b.metadata as Record<string, unknown>) : {},
      published: b.published !== false,
    },
  };
}

export type EntityInput = {
  slug: string;
  name: string;
  type: string;
  description: string;
  url: string | null;
  aliases: string[];
  metadata: Record<string, unknown>;
  published: boolean;
};

export type ReviewAction = "approve" | "reject" | "publish" | "submit_review";

export function validateReviewAction(action: unknown): action is ReviewAction {
  return action === "approve" || action === "reject" || action === "publish" || action === "submit_review";
}
