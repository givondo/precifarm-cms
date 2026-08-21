import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoContent, seoEntities, seoPageTemplates } from "@/db/schema";
import {
  mapSeoContent,
  mapSeoPageTemplate,
  type SeoContentRow,
  type SeoPageTemplateRow,
} from "@/lib/seo/types";

type TemplateVars = Record<string, string>;

function applyTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

export async function listPageTemplates() {
  const db = getDb();
  const rows = await db.select().from(seoPageTemplates).orderBy(seoPageTemplates.name);
  return rows.map((row) => mapSeoPageTemplate(row as SeoPageTemplateRow));
}

export async function getPageTemplateBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(seoPageTemplates).where(eq(seoPageTemplates.slug, slug)).limit(1);
  return row ? mapSeoPageTemplate(row as SeoPageTemplateRow) : null;
}

export function renderLocalPageFromTemplate(
  template: ReturnType<typeof mapSeoPageTemplate>,
  entity: { slug: string; name: string; description: string; metadata: Record<string, unknown> },
): {
  slug: string;
  title: string;
  description: string;
  bodyMd: string | null;
  aisoBlocks: unknown[];
} {
  const county = String(entity.metadata.county ?? entity.metadata.region ?? "Kenya");
  const vars: TemplateVars = {
    city: entity.name,
    slug: entity.slug,
    county,
    name: entity.name,
    description: entity.description,
  };

  const slug = applyTemplate(template.slugPattern, vars);
  const title = applyTemplate(template.titleTemplate, vars);
  const description = applyTemplate(template.descriptionTemplate, vars);
  const bodyMd = template.bodyTemplate ? applyTemplate(template.bodyTemplate, vars) : null;

  const aisoBlocks = template.aisoTemplate.map((block) => ({
    ...block,
    title: applyTemplate(block.title, vars),
    content: block.content ? applyTemplate(block.content, vars) : undefined,
  }));

  return { slug, title, description, bodyMd, aisoBlocks };
}

export async function generateLocalPagesFromTemplate(templateSlug: string) {
  const template = await getPageTemplateBySlug(templateSlug);
  if (!template) throw new Error("Template not found.");

  const db = getDb();
  const entities = await db
    .select()
    .from(seoEntities)
    .where(eq(seoEntities.type, template.entityType));

  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (const entity of entities) {
    try {
      const rendered = renderLocalPageFromTemplate(template, {
        slug: entity.slug,
        name: entity.name,
        description: entity.description,
        metadata: (entity.metadata as Record<string, unknown>) ?? {},
      });

      await db
        .insert(seoContent)
        .values({
        slug: rendered.slug,
        locale: "en-KE",
        title: rendered.title,
          description: rendered.description,
          bodyMd: rendered.bodyMd,
          contentType: template.contentType,
          entityIds: [entity.id],
          aisoBlocks: rendered.aisoBlocks,
          status: "draft",
          reviewStatus: "pending_review",
          authorName: "Precifarm",
          templateId: template.id,
          updatedAt: new Date(),
        })
    .onConflictDoUpdate({
      target: [seoContent.slug, seoContent.locale],
      set: {
            title: rendered.title,
            description: rendered.description,
            bodyMd: rendered.bodyMd,
            aisoBlocks: rendered.aisoBlocks,
            entityIds: [entity.id],
            templateId: template.id,
            updatedAt: new Date(),
          },
        });

      results.push({ slug: rendered.slug, ok: true });
    } catch (err) {
      results.push({
        slug: entity.slug,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { template: template.slug, results };
}

export async function upsertDefaultLocalTemplate() {
  const db = getDb();
  const [row] = await db
    .insert(seoPageTemplates)
    .values({
      slug: "ev-charging-city",
      name: "EV Charging Hub — City",
      contentType: "local_page",
      slugPattern: "ev-charging-{slug}",
      titleTemplate: "EV charging in {city}, Kenya — Precifarm",
      descriptionTemplate:
        "Home Pulse and Pod charging, Corridor DC and Boda Hub in {city}, {county}. Public DC from KES 39/kWh — M-Pesa on every product.",
      bodyTemplate: `## EV charging in {city}

Precifarm installs, finances and operates EV charging in {city} and {county} — home **Pulse** and **Pod** chargers, **Corridor DC** on intercity routes and **Boda Hub** swap where live.

### Home charging

The **Pulse charger** starts from **KES 79,000** with Lipa Pole Pole on M-Pesa. A typical driving day of about 60 km costs about **KES 140** in home electricity versus about **KES 850** in petrol.

Request a survey at [precifarm.com/charging/private-house](https://precifarm.com/charging/private-house).

### Public and corridor charging

Public DC at Depot and Corridor sites starts from **KES 39/kWh**. Find live chargers on the [Charging Hub](https://precifarm.com/network).`,
      aisoTemplate: [
        {
          id: "summary",
          type: "executive_summary",
          title: "EV charging in {city}",
          content:
            "Precifarm home Pulse and Pod, Corridor DC and Boda Hub in {city}, {county}. Public DC from KES 39/kWh.",
        },
        {
          id: "facts",
          type: "key_facts",
          title: "Key facts",
          items: [
            "City: {city}",
            "County: {county}",
            "Pulse from KES 79,000 · public DC from KES 39/kWh",
            "Charging Hub: precifarm.com/network",
          ],
        },
      ],
      entityType: "location",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: seoPageTemplates.slug,
      set: { updatedAt: new Date() },
    })
    .returning();

  return mapSeoPageTemplate(row as SeoPageTemplateRow);
}

export async function listLocalPages() {
  const db = getDb();
  const rows = await db
    .select()
    .from(seoContent)
    .where(eq(seoContent.contentType, "local_page"));

  return rows.map((row) => mapSeoContent(row as SeoContentRow));
}
