"use client";

import { useState } from "react";

export function SeoEmbeddingActions({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/seo/embeddings", { method: "POST" });
      const json = (await res.json()) as {
        data?: { stats?: { embedded: number; published: number } };
        error?: { message?: string };
      };
      if (!res.ok) {
        setStatus(json.error?.message ?? "Embedding generation failed.");
        return;
      }
      const stats = json.data?.stats;
      setStatus(
        stats
          ? `Updated — ${stats.embedded}/${stats.published} items embedded.`
          : "Embeddings generated.",
      );
    } catch {
      setStatus("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={generate}
        disabled={!configured || busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate embeddings"}
      </button>
      {!configured && (
        <span className="text-xs text-amber-700">Set OPENAI_API_KEY to enable semantic search.</span>
      )}
      {status && <span className="text-sm text-gray-600">{status}</span>}
    </div>
  );
}
