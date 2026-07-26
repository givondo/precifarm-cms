"use client";

import { useState } from "react";

export function GapDraftButton({ query }: { query: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generateDraft() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/seo/admin/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: query, gapQuery: query, contentType: "guide", save: true }),
      });
      const json = (await res.json()) as {
        data?: { content?: { slug: string; title: string } };
        error?: { message?: string };
      };
      if (!res.ok) {
        setStatus(json.error?.message ?? "Generation failed.");
        return;
      }
      const slug = json.data?.content?.slug;
      setStatus(slug ? `Draft saved: ${slug}` : "Draft saved.");
    } catch {
      setStatus("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={generateDraft}
        disabled={busy}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "…" : "AI draft"}
      </button>
      {status && <span className="text-xs text-gray-500">{status}</span>}
    </div>
  );
}
