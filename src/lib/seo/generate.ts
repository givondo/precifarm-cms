import type { AisoBlock, SeoContentType, SeoSource } from "@/lib/seo/types";

const DEFAULT_MODEL = process.env.SEO_CONTENT_MODEL?.trim() || "gpt-4o-mini";

export function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export function isContentGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type GeneratedDraft = {
  slug: string;
  title: string;
  description: string;
  bodyMd: string;
  aisoBlocks: AisoBlock[];
  sources: SeoSource[];
};

export async function generateContentDraft(input: {
  topic: string;
  contentType: SeoContentType;
  gapQuery?: string;
  context?: string;
}): Promise<GeneratedDraft & { generationMetadata: Record<string, unknown> }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = DEFAULT_MODEL;
  const siteContext =
    input.context ??
    "Precifarm builds EV charging hubs and operates electric intercity coach service in Kenya (Nairobi–Kisumu).";

  const systemPrompt = `You are an SEO content writer for Precifarm, a Kenyan electric transport company.
Write accurate, helpful content for humans and AI search engines. Use markdown for body.
Return ONLY valid JSON with keys: title, description, bodyMd, aisoBlocks, sources.
aisoBlocks is an array of {id, type, title, content?, items?} using types: executive_summary, key_facts, faq, how_to.
sources is an array of {title, url, accessedAt} citing authoritative references when applicable.
contentType: ${input.contentType}. Keep description 120-160 chars.`;

  const userPrompt = `Topic: ${input.topic}
${input.gapQuery ? `Target search query: ${input.gapQuery}` : ""}
Brand context: ${siteContext}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Content generation failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  const raw = json.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty generation response.");

  const parsed = JSON.parse(raw) as {
    title?: string;
    description?: string;
    bodyMd?: string;
    aisoBlocks?: AisoBlock[];
    sources?: SeoSource[];
  };

  const title = String(parsed.title ?? input.topic).trim();
  const description = String(parsed.description ?? "").trim();
  if (description.length < 20) {
    throw new Error("Generated description too short.");
  }

  const slug = slugifyTopic(title || input.topic);

  return {
    slug,
    title,
    description,
    bodyMd: String(parsed.bodyMd ?? ""),
    aisoBlocks: Array.isArray(parsed.aisoBlocks) ? parsed.aisoBlocks : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    generationMetadata: {
      model,
      topic: input.topic,
      gapQuery: input.gapQuery ?? null,
      generatedAt: new Date().toISOString(),
    },
  };
}
