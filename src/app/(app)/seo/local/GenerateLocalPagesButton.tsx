"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateLocalPagesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/seo/admin/local-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSlug: "ev-charging-city" }),
      });
      const json = (await res.json()) as {
        data?: { results?: { slug: string; ok: boolean }[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setStatus(json.error?.message ?? "Generation failed.");
        return;
      }
      const ok = json.data?.results?.filter((r) => r.ok).length ?? 0;
      setStatus(`Generated ${ok} local page draft(s).`);
      router.refresh();
    } catch {
      setStatus("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate local pages"}
      </button>
      {status && <span className="text-sm text-gray-600">{status}</span>}
    </div>
  );
}
