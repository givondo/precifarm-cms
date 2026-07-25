"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getDeliveryStageLabel, type CargoDeliveryStatus } from "@/lib/cargo";
import type { LastMileDeliveryRow, RiderSummary } from "@/lib/cargo-delivery";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { DeliveryStatusBadge } from "@/components/ui/DeliveryStatusBadge";
import {
  apiFetch,
  getApiErrorMessage,
  OFFLINE_ERROR,
  readJson,
} from "@/lib/client-api";
import { riderStatusBadgeClass } from "@/lib/riders";

import { formatPhoneDisplay } from "@/lib/booking";

type Rider = RiderSummary;
type LastMileRow = LastMileDeliveryRow;

export default function LastMilePage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [rows, setRows] = useState<LastMileRow[]>([]);
  const [bucket, setBucket] = useState<"ready" | "active" | "upcoming" | "completed">("ready");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionRef, setActionRef] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const cities = useMemo(() => {
    const set = new Set(riders.map((r) => r.city));
    return Array.from(set).sort();
  }, [riders]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ bucket });
    if (search.trim()) params.set("q", search.trim());

    try {
      const [ridersRes, deliveriesRes] = await Promise.all([
        apiFetch(
          `/api/v1/ops/riders${cityFilter !== "all" ? `?city=${encodeURIComponent(cityFilter)}` : ""}`
        ),
        apiFetch(`/api/v1/ops/last-mile/deliveries?${params}`),
      ]);

      const ridersJson = await readJson<{ data?: Rider[]; error?: { message?: string } }>(ridersRes);
      const deliveriesJson = await readJson<{ data?: LastMileRow[]; error?: { message?: string } }>(
        deliveriesRes
      );

      if (!ridersRes.ok) {
        setError(getApiErrorMessage(ridersJson, "Failed to load riders."));
        return;
      }
      if (!deliveriesRes.ok) {
        setError(getApiErrorMessage(deliveriesJson, "Failed to load last mile deliveries."));
        return;
      }

      setRiders(ridersJson.data ?? []);
      setRows(deliveriesJson.data ?? []);

      setSelectedRiders((prev) => {
        const next = { ...prev };
        for (const row of deliveriesJson.data ?? []) {
          if (row.riderId && !next[row.reference]) {
            next[row.reference] = row.riderId;
          }
        }
        return next;
      });
    } catch {
      setError(OFFLINE_ERROR);
    } finally {
      setLoading(false);
    }
  }, [bucket, search, cityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssign(reference: string, dispatch = false) {
    const riderId = selectedRiders[reference];
    if (!riderId) {
      setError("Select a rider first.");
      return;
    }

    setActionRef(reference);
    setError("");
    setSuccess("");

    try {
      const res = await apiFetch(`/api/v1/ops/cargo/${encodeURIComponent(reference)}/rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId, dispatch }),
      });
      const json = await readJson<{ data?: { message?: string }; error?: { message?: string } }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(json, "Failed to assign rider."));
        return;
      }
      setSuccess(json.data?.message ?? "Rider assigned.");
      await load();
    } catch {
      setError(OFFLINE_ERROR);
    } finally {
      setActionRef(null);
    }
  }

  const filteredRiders = riders.filter(
    (r) => cityFilter === "all" || r.city === cityFilter
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Last mile delivery</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign riders to last mile cargo and dispatch to the receiver&apos;s address
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Delivery riders
          </div>
          <select
            className="input max-w-[180px] text-sm"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="all">All cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {filteredRiders.map((rider) => (
            <div key={rider.id} className="stat-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{rider.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {rider.city} · {rider.vehicle}
                  </div>
                </div>
                <span className={`badge ${riderStatusBadgeClass(rider.status)}`}>
                  {rider.statusLabel}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-2">{formatPhoneDisplay(rider.phone)}</div>
              <div className="text-xs text-gray-600 mt-1">
                {rider.activeDeliveries} active delivery
                {rider.activeDeliveries === 1 ? "" : "ies"}
              </div>
            </div>
          ))}
          {filteredRiders.length === 0 && (
            <div className="text-sm text-gray-400 col-span-full py-4">
              No riders found for this city.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["ready", "Ready to dispatch"],
            ["active", "Out for delivery"],
            ["upcoming", "Upcoming"],
            ["completed", "Completed"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn btn-secondary text-xs ${bucket === key ? "!bg-green-50 !border-green-200" : ""}`}
            onClick={() => setBucket(key)}
          >
            {label}
          </button>
        ))}
        <form
          className="flex gap-2 ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="input max-w-xs"
            placeholder="Search reference, receiver, address…"
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

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Destination</th>
              <th>Receiver</th>
              <th>Address</th>
              <th>Cargo</th>
              <th>Stage</th>
              <th>Rider</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8">
                  No last mile deliveries in this section.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const cityRiders = riders.filter((r) => r.city === row.destinationCity);
                const selectedId = selectedRiders[row.reference] ?? row.riderId ?? "";
                const busy = actionRef === row.reference;

                return (
                  <tr key={row.reference}>
                    <td className="font-mono text-xs font-medium">{row.reference}</td>
                    <td className="text-sm">
                      {row.to}
                      <span className="block text-xs text-gray-500">
                        {row.date} · {row.time}
                      </span>
                    </td>
                    <td className="text-sm">
                      {row.receiverName}
                      <span className="block text-xs text-gray-500">
                        {formatPhoneDisplay(row.receiverPhone)}
                      </span>
                    </td>
                    <td className="text-sm max-w-[200px]">{row.deliveryAddress ?? "—"}</td>
                    <td className="text-sm">
                      {row.weightKg} kg
                      <span className="block text-xs text-gray-500 truncate max-w-[120px]">
                        {row.description}
                      </span>
                    </td>
                    <td className="text-sm">
                      <DeliveryStatusBadge status={row.deliveryStatus} />
                    </td>
                    <td>
                      {row.canAssignRider ? (
                        <select
                          className="input text-sm min-w-[160px]"
                          value={selectedId}
                          onChange={(e) =>
                            setSelectedRiders((prev) => ({
                              ...prev,
                              [row.reference]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select rider…</option>
                          {cityRiders.map((rider) => (
                            <option
                              key={rider.id}
                              value={rider.id}
                              disabled={rider.status === "off_duty"}
                            >
                              {rider.name} · {rider.vehicle}
                              {rider.status === "on_delivery" ? " (busy)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : row.rider ? (
                        <div className="text-sm">
                          {row.rider.name}
                          <span className="block text-xs text-gray-500">{row.rider.vehicle}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Awaiting hub arrival</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 min-w-[130px]">
                        {row.deliveryStatus === "arrived" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary text-xs"
                              disabled={busy || !selectedId}
                              onClick={() => handleAssign(row.reference, false)}
                            >
                              {busy ? "…" : "Assign rider"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary text-xs"
                              disabled={busy || !selectedId}
                              onClick={() => handleAssign(row.reference, true)}
                            >
                              {busy ? "…" : "Assign & dispatch"}
                            </button>
                          </>
                        )}
                        {row.deliveryStatus === "out_for_delivery" && row.canAssignRider && (
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            disabled={busy || !selectedId || selectedId === row.riderId}
                            onClick={() => handleAssign(row.reference, false)}
                          >
                            {busy ? "…" : "Change rider"}
                          </button>
                        )}
                        {row.deliveryStatus === "out_for_delivery" && (
                          <span className="text-xs text-green-700">Dispatched</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
