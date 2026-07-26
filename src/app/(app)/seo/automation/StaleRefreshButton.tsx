"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StaleRefreshButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/seo/stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxItems: 3 }),
      });
      const json = (await res.json()) as {
        data?: { results?: { slug: string; ok: boolean; refreshSlug?: string }[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setStatus(json.error?.message ?? "Refresh failed.");
        return;
      }
      const ok = json.data?.results?.filter((r) => r.ok).length ?? 0;
      setStatus(`Queued ${ok} stale refresh draft(s) for review.`);
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
        onClick={refresh}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Refreshing…" : "Refresh stale content"}
      </button>
      {status && <span className="text-sm text-gray-600">{status}</span>}
    </div>
  );
}
