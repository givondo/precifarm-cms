"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CARGO_DELIVERY_STAGES,
  deliveryStagePath,
  getDeliveryStageLabel,
  type CargoDeliveryStatus,
} from "@/lib/cargo";
import { formatPhoneDisplay } from "@/lib/booking";
import type { CargoDeliveryRow, DeliveryMessageRecord } from "@/lib/cargo-delivery";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { DeliveryStatusBadge } from "@/components/ui/DeliveryStatusBadge";
import {
  apiFetch,
  getApiErrorMessage,
  OFFLINE_ERROR,
  readJson,
} from "@/lib/client-api";

export type DeliveryRow = CargoDeliveryRow;

export default function DeliveryDesk({
  initialRows,
  initialFilter,
  initialSearch,
}: {
  initialRows: DeliveryRow[];
  initialFilter: "active" | "completed";
  initialSearch: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [messages, setMessages] = useState<DeliveryMessageRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setRows(initialRows);
    setFilter(initialFilter);
    setSearch(initialSearch);
  }, [initialRows, initialFilter, initialSearch]);

  const loadDetail = useCallback(async (reference: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/v1/ops/cargo/${encodeURIComponent(reference)}/delivery-status`
      );
      const json = await readJson<{ data?: { deliveryMessages?: DeliveryMessageRecord[] }; error?: { message?: string } }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(json, "Failed to load delivery detail."));
        return;
      }
      setMessages(json.data?.deliveryMessages ?? []);
    } catch {
      setError(OFFLINE_ERROR);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRef) loadDetail(selectedRef);
    else setMessages([]);
  }, [selectedRef, loadDetail]);

  function navigateList(nextFilter: "active" | "completed", nextSearch = search) {
    const params = new URLSearchParams({ status: nextFilter });
    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    router.push(`/delivery?${params.toString()}`);
  }

  async function handleAdvance(reference: string, stage?: CargoDeliveryStatus) {
    setActionLoading(true);
    setSuccess("");
    setError("");
    try {
      const res = await apiFetch(
        `/api/v1/ops/cargo/${encodeURIComponent(reference)}/delivery-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stage ? { stage } : {}),
        }
      );
      const json = await readJson<{ data?: { message?: string }; error?: { message?: string } }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(json, "Failed to update delivery stage."));
        return;
      }
      setSuccess(json.data?.message ?? "Delivery stage updated.");
      router.refresh();
      if (selectedRef === reference) {
        await loadDetail(reference);
      }
    } catch {
      setError(OFFLINE_ERROR);
    } finally {
      setActionLoading(false);
    }
  }

  const selected = rows.find((r) => r.reference === selectedRef) ?? null;
  const selectedPath = selected ? deliveryStagePath(selected.lastMileDelivery) : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery tracking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Advance cargo through each stage — sender and receiver get SMS updates automatically
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className={`btn btn-secondary text-xs ${filter === "active" ? "!bg-green-50 !border-green-200" : ""}`}
          onClick={() => navigateList("active")}
        >
          In progress
        </button>
        <button
          type="button"
          className={`btn btn-secondary text-xs ${filter === "completed" ? "!bg-green-50 !border-green-200" : ""}`}
          onClick={() => navigateList("completed")}
        >
          Completed
        </button>
        <form
          className="flex gap-2 ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            navigateList(filter, search);
          }}
        >
          <input
            className="input max-w-xs"
            placeholder="Search reference, name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary shrink-0">
            Search
          </button>
        </form>
      </div>

      {error && <AlertBanner tone="error" message={error} />}
      {success && <AlertBanner tone="success" message={success} />}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Route</th>
                <th>Travel</th>
                <th>Sender → Receiver</th>
                <th>Cargo</th>
                <th>Stage</th>
                <th>Messages</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">
                    No cargo deliveries match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.reference}
                    className={selectedRef === row.reference ? "bg-green-50/60" : undefined}
                  >
                    <td className="font-mono text-xs font-medium">{row.reference}</td>
                    <td className="text-sm">
                      {row.from} → {row.to}
                      {row.lastMileDelivery && (
                        <span className="block text-xs text-green-700">Last mile</span>
                      )}
                    </td>
                    <td className="text-sm whitespace-nowrap">
                      {row.date}
                      <br />
                      {row.time}
                    </td>
                    <td className="text-sm">
                      {row.senderName}
                      <span className="text-gray-400"> → </span>
                      {row.receiverName}
                    </td>
                    <td className="text-sm">
                      {row.weightKg} kg
                      <span className="block text-xs text-gray-500 truncate max-w-[120px]">
                        {row.description}
                      </span>
                    </td>
                    <td>
                      <DeliveryStatusBadge status={row.deliveryStatus} />
                    </td>
                    <td className="text-sm text-center">{row.messageCount}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary text-xs"
                        onClick={() => setSelectedRef(row.reference)}
                      >
                        Track
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-2">
          {!selected ? (
            <div className="card text-sm text-gray-500">
              Select a cargo shipment to view the delivery timeline and send stage updates.
            </div>
          ) : (
            <div className="card">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="font-mono font-bold text-lg">{selected.reference}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {selected.from} → {selected.to} · {selected.date} {selected.time}
                  </div>
                </div>
                <DeliveryStatusBadge status={selected.deliveryStatus} />
              </div>

              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Delivery timeline
                </div>
                <ol className="space-y-2">
                  {selectedPath.map((stage) => {
                    const idx = selectedPath.indexOf(stage);
                    const currentIdx = selectedPath.indexOf(selected.deliveryStatus);
                    const done = idx < currentIdx || selected.deliveryStatus === "delivered";
                    const current = stage === selected.deliveryStatus;
                    const meta = CARGO_DELIVERY_STAGES.find((s) => s.id === stage);
                    return (
                      <li
                        key={stage}
                        className={`flex gap-3 text-sm rounded-md px-3 py-2 ${
                          current ? "bg-green-50 border border-green-200" : "border border-transparent"
                        }`}
                      >
                        <span
                          className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            done || current ? "bg-green-600" : "bg-gray-300"
                          }`}
                        />
                        <div>
                          <div className={`font-medium ${current ? "text-green-900" : "text-gray-900"}`}>
                            {meta?.label ?? stage}
                          </div>
                          <div className="text-xs text-gray-500">{meta?.description}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {selected.lastMileDelivery && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <div className="font-medium text-green-900">Last mile delivery</div>
                  <div className="text-green-800 text-xs mt-1">
                    {selected.deliveryAddress ?? "Address on file"}
                  </div>
                  {selected.rider ? (
                    <div className="text-green-800 text-xs mt-1">
                      Rider: {selected.rider.name} · {selected.rider.vehicle} ·{" "}
                      {formatPhoneDisplay(selected.rider.phone)}
                    </div>
                  ) : selected.deliveryStatus === "arrived" &&
                    selected.nextStage === "out_for_delivery" ? (
                    <a href="/last-mile" className="text-xs text-green-700 underline mt-1 inline-block">
                      Assign a rider on Last Mile →
                    </a>
                  ) : null}
                </div>
              )}

              {selected.nextStage === "out_for_delivery" &&
                selected.lastMileDelivery &&
                !selected.rider && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
                    Assign a rider on the Last Mile page before dispatching.
                  </p>
                )}

              {selected.nextStage && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      actionLoading ||
                      (selected.nextStage === "out_for_delivery" &&
                        selected.lastMileDelivery &&
                        !selected.rider)
                    }
                    onClick={() => handleAdvance(selected.reference)}
                  >
                    {actionLoading ? "Sending…" : `Notify: ${selected.nextStageLabel}`}
                  </button>
                  {selected.lastMileDelivery &&
                    (selected.deliveryStatus === "out_for_delivery" ||
                      selected.deliveryStatus === "arrived") && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={actionLoading}
                        onClick={() => handleAdvance(selected.reference, "failed_delivery")}
                      >
                        Mark failed delivery
                      </button>
                    )}
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Messages sent
                </div>
                {detailLoading ? (
                  <p className="text-sm text-gray-400">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages logged yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="border border-gray-200 rounded-md p-3 text-sm bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium capitalize">
                            {getDeliveryStageLabel(msg.stage)} · {msg.recipient}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.sentAt).toLocaleString("en-KE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          {formatPhoneDisplay(msg.phone)}
                        </div>
                        <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700">
                          {msg.body}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
