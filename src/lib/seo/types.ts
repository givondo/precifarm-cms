export type SeoEntityType =
  | "equipment"
  | "component"
  | "manufacturer"
  | "brand"
  | "model"
  | "location"
  | "service"
  | "procedure"
  | "symptom"
  | "solution"
  | "route"
  | "organization"
  | "article"
  | "faq";

export type SeoContentType = "guide" | "faq" | "article" | "howto" | "local_page";

export type SeoContentStatus = "draft" | "published" | "archived";

export type SeoReviewStatus = "pending_review" | "approved" | "rejected";

export type SeoSource = {
  title: string;
  url: string;
  accessedAt?: string;
};

export type AisoBlock = {
  id: string;
  type: string;
  title: string;
  content?: string;
  items?: unknown[];
};

export type SeoEntityRow = {
  id: string;
  slug: string;
  type: string;
  name: string;
  description: string;
  aliases: string[];
  metadata: Record<string, unknown>;
  url: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SeoContentRow = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  description: string;
  bodyMd: string | null;
  contentType: string;
  entityIds: string[];
  schemaJson: Record<string, unknown> | null;
  aisoBlocks: AisoBlock[];
  status: string;
  authorName: string | null;
  reviewerName: string | null;
  reviewStatus: string | null;
  reviewNotes: string | null;
  aiGenerated: boolean;
  generationMetadata: Record<string, unknown> | null;
  sources: SeoSource[];
  templateId: string | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SeoPageTemplateRow = {
  id: string;
  slug: string;
  name: string;
  contentType: string;
  slugPattern: string;
  titleTemplate: string;
  descriptionTemplate: string;
  bodyTemplate: string | null;
  aisoTemplate: AisoBlock[];
  entityType: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mapSeoEntity(row: SeoEntityRow) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    metadata: row.metadata,
    url: row.url,
    published: row.published,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSeoContent(row: SeoContentRow) {
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    description: row.description,
    bodyMd: row.bodyMd,
    contentType: row.contentType,
    entityIds: row.entityIds,
    schemaJson: row.schemaJson,
    aisoBlocks: row.aisoBlocks,
    status: row.status,
    authorName: row.authorName,
    reviewerName: row.reviewerName,
    reviewStatus: row.reviewStatus,
    reviewNotes: row.reviewNotes,
    aiGenerated: row.aiGenerated,
    generationMetadata: row.generationMetadata,
    sources: row.sources ?? [],
    templateId: row.templateId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSeoPageTemplate(row: SeoPageTemplateRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    contentType: row.contentType,
    slugPattern: row.slugPattern,
    titleTemplate: row.titleTemplate,
    descriptionTemplate: row.descriptionTemplate,
    bodyTemplate: row.bodyTemplate,
    aisoTemplate: row.aisoTemplate,
    entityType: row.entityType,
    updatedAt: row.updatedAt.toISOString(),
  };
}
