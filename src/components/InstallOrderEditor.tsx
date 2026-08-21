"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InstallStage } from "@/lib/ev-ops";
import { installStageLabels } from "@/lib/ev-ops";

const STAGES = Object.keys(installStageLabels) as InstallStage[];

type Props = {
  reference: string;
  stage: InstallStage;
  quoteAmount?: number;
  depositAmount?: number;
};

export default function InstallOrderEditor({
  reference,
  stage,
  quoteAmount,
  depositAmount,
}: Props) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState(stage);
  const [quote, setQuote] = useState(quoteAmount != null ? String(quoteAmount) : "");
  const [deposit, setDeposit] = useState(depositAmount != null ? String(depositAmount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: {
    stage?: InstallStage;
    quoteAmount?: number;
    depositAmount?: number;
  }) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/ops/installs/${encodeURIComponent(reference)}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save changes.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onStageChange(next: InstallStage) {
    const prior = currentStage;
    setCurrentStage(next);
    const ok = await save({
      stage: next,
      quoteAmount: quote ? Number(quote) : undefined,
      depositAmount: deposit ? Number(deposit) : undefined,
    });
    if (!ok) setCurrentStage(prior);
  }

  async function onSaveAmounts() {
    await save({
      stage: currentStage,
      quoteAmount: quote ? Number(quote) : undefined,
      depositAmount: deposit ? Number(deposit) : undefined,
    });
  }

  return (
    <div className="space-y-2 min-w-[11rem]">
      <select
        value={currentStage}
        disabled={saving}
        onChange={(e) => onStageChange(e.target.value as InstallStage)}
        className="text-sm border border-gray-200 rounded px-2 py-1 bg-white w-full"
        aria-label={`Stage for ${reference}`}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {installStageLabels[s]}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <input
          type="number"
          min={0}
          step={1000}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Quote"
          className="text-xs border border-gray-200 rounded px-2 py-1 w-full"
          aria-label={`Quote for ${reference}`}
        />
        <input
          type="number"
          min={0}
          step={500}
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          placeholder="Deposit"
          className="text-xs border border-gray-200 rounded px-2 py-1 w-full"
          aria-label={`Deposit for ${reference}`}
        />
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={onSaveAmounts}
        className="text-xs text-green-800 hover:underline disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save amounts"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
