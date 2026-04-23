"use client";

import { MapPin, Radar } from "lucide-react";

interface Props { data: unknown; }

interface Cluster {
  cluster_id: number;
  barangay?: string;
  incident_count?: number;
  center_lat?: number;
  center_lng?: number;
}

function formatNumber(value?: number, digits = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function DBSCANView({ data }: Props) {
  if (!data) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No DBSCAN data. Pipeline has not run yet.</div>;
  }

  const parsed = data as {
    clusters?: Cluster[];
    noise_count?: number;
    silhouette_score?: number;
  };
  const clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];

  if (clusters.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No clusters found in data.</div>;
  }

  const sorted = [...clusters].sort(
    (a, b) => (b.incident_count ?? 0) - (a.incident_count ?? 0)
  );
  const topCluster = sorted[0];
  const maxCount = topCluster?.incident_count ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-amber-500/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-300/80">Primary hotspot</p>
            <p className="mt-2 text-xl font-semibold text-red-100">
              {topCluster?.barangay ?? "Unknown barangay"}
            </p>
            <p className="mt-1 text-sm text-red-200/80">
              {formatNumber(topCluster?.incident_count)} incidents in the highest-ranked cluster
            </p>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-950/40 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wide text-red-200/70">Cluster ID</p>
            <p className="mt-1 text-lg font-semibold text-white">#{topCluster?.cluster_id ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-[11px] text-gray-500">Clusters</p>
          <p className="mt-2 text-lg font-semibold text-gray-100">{clusters.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-[11px] text-gray-500">Silhouette</p>
          <p className="mt-2 text-lg font-semibold text-gray-100">
            {formatNumber(parsed.silhouette_score, 3)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
          <p className="text-[11px] text-gray-500">Noise</p>
          <p className="mt-2 text-lg font-semibold text-gray-100">
            {formatNumber(parsed.noise_count)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((cluster, index) => {
          const incidentCount = cluster.incident_count ?? 0;
          const width = maxCount > 0 ? Math.max(14, (incidentCount / maxCount) * 100) : 14;
          const isTop = index === 0;

          return (
            <div
              key={cluster.cluster_id}
              className={`rounded-2xl border px-4 py-3 ${
                isTop
                  ? "border-red-500/20 bg-red-500/10"
                  : "border-gray-800 bg-gray-950/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold ${
                      isTop ? "bg-red-500 text-white" : "bg-gray-800 text-gray-200"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-500" />
                        <p className="truncate text-sm font-medium text-gray-100">
                          {cluster.barangay ?? "Unknown barangay"}
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Cluster #{cluster.cluster_id} • {incidentCount} incidents
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${isTop ? "bg-red-500" : "bg-purple-500"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900/80 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Centroid</p>
                  <p className="mt-1 text-xs text-gray-300">
                    {formatNumber(cluster.center_lat, 4)}, {formatNumber(cluster.center_lng, 4)}
                  </p>
                </div>
              </div>
              {isTop ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-950/30 px-3 py-2 text-xs text-red-100">
                  <Radar className="h-3.5 w-3.5" />
                  Highest concentration hotspot in the latest DBSCAN output.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
