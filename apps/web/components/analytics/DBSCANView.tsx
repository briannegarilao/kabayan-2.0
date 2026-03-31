// apps/web/components/analytics/DBSCANView.tsx
"use client";

import { MapPin } from "lucide-react";

interface Props { data: unknown; }

// Expected shape: { clusters: [{ cluster_id: 0, barangay: "Paliparan I", incident_count: 15, center_lat: 14.32, center_lng: 120.93 }], noise_count: 3, silhouette_score: 0.955 }
interface Cluster {
  cluster_id: number;
  barangay: string;
  incident_count: number;
  center_lat: number;
  center_lng: number;
}

export function DBSCANView({ data }: Props) {
  if (!data) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No DBSCAN data. Pipeline has not run yet.</div>;
  }

  const parsed = data as { clusters?: Cluster[]; noise_count?: number; silhouette_score?: number };
  const clusters = parsed.clusters || [];

  if (clusters.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No clusters found in data.</div>;
  }

  // Sort by incident count descending
  const sorted = [...clusters].sort((a, b) => b.incident_count - a.incident_count);

  return (
    <div className="space-y-3">
      {/* Score */}
      {parsed.silhouette_score != null && (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Silhouette Score: <span className="font-mono text-gray-300">{parsed.silhouette_score.toFixed(3)}</span></span>
          {parsed.noise_count != null && <span>Noise points: {parsed.noise_count}</span>}
        </div>
      )}

      {/* Cluster list */}
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {sorted.map((c) => {
          // Color intensity based on incident count relative to max
          const maxCount = sorted[0].incident_count;
          const intensity = Math.max(0.3, c.incident_count / maxCount);

          return (
            <div key={c.cluster_id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: `rgba(239, 68, 68, ${intensity})` }}
              >
                {c.incident_count}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-gray-500" />
                  <span className="text-sm font-medium text-gray-200">{c.barangay}</span>
                </div>
                <p className="text-[10px] text-gray-500">Cluster #{c.cluster_id} &middot; {c.incident_count} incidents</p>
              </div>
              {/* Bar indicator */}
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${intensity * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
