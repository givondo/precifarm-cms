"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({ slug }: { slug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function review(action: "approve" | "reject" | "publish") {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/seo/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setStatus(json.error?.message ?? "Review action failed.");
        return;
      }
      setStatus(action === "publish" ? "Published." : `${action}d.`);
      router.refresh();
    } catch {
      setStatus("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => review("approve")}
        className="rounded-md border border-green-300 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => review("publish")}
        className="rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        Publish
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => review("reject")}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
      {status && <span className="text-xs text-gray-500">{status}</span>}
    </div>
  );
}
