/** Cosine similarity for embedding vectors stored as JSON number arrays */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function embeddingText(input: {
  title: string;
  description: string;
  bodyMd?: string | null;
}): string {
  return [input.title, input.description, input.bodyMd ?? ""].filter(Boolean).join("\n\n").slice(0, 8000);
}

const DEFAULT_MODEL = "text-embedding-3-small";

export async function generateEmbedding(text: string): Promise<{ model: string; dimensions: number; vector: number[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.SEO_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[] }[];
  };

  const vector = json.data[0]?.embedding;
  if (!vector?.length) {
    throw new Error("Empty embedding response.");
  }

  return { model, dimensions: vector.length, vector };
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
