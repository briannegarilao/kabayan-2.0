// apps/web/components/dev/StatsPanel.tsx
interface DevStats {
  generated_at?: string;
  incidents?: {
    pending?: number;
    assigned?: number;
    in_progress?: number;
    resolved?: number;
    simulated_total?: number;
    simulated_active?: number;
  };
  responders?: {
    total?: number;
    available?: number;
    unavailable?: number;
    with_load?: number;
  };
  trips?: {
    active?: number;
    completed?: number;
    cancelled?: number;
    simulated_total?: number;
    simulated_active?: number;
  };
  evacuation_centers?: {
    total?: number;
    open?: number;
    closed?: number;
    total_occupancy?: number;
  };
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-lg border bg-gray-950/50 p-3 ${accent ?? "border-gray-800"}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export function StatsPanel({ stats }: { stats: DevStats | null }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Simulation Snapshot
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Current system counts from `/api/dev/stats`
        </p>
      </div>

      {!stats ? (
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-sm text-gray-500">
          Stats not loaded yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Incidents
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Pending" value={stats.incidents?.pending ?? 0} />
              <StatCard
                label="Assigned"
                value={stats.incidents?.assigned ?? 0}
              />
              <StatCard
                label="In Progress"
                value={stats.incidents?.in_progress ?? 0}
              />
              <StatCard
                label="Sim Active"
                value={stats.incidents?.simulated_active ?? 0}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Responders
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total" value={stats.responders?.total ?? 0} />
              <StatCard
                label="Available"
                value={stats.responders?.available ?? 0}
              />
              <StatCard
                label="Unavailable"
                value={stats.responders?.unavailable ?? 0}
              />
              <StatCard
                label="With Load"
                value={stats.responders?.with_load ?? 0}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Trips
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Active" value={stats.trips?.active ?? 0} />
              <StatCard label="Completed" value={stats.trips?.completed ?? 0} />
              <StatCard label="Cancelled" value={stats.trips?.cancelled ?? 0} />
              <StatCard
                label="Sim Active"
                value={stats.trips?.simulated_active ?? 0}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Evacuation
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total"
                value={stats.evacuation_centers?.total ?? 0}
              />
              <StatCard
                label="Open"
                value={stats.evacuation_centers?.open ?? 0}
              />
              <StatCard
                label="Closed"
                value={stats.evacuation_centers?.closed ?? 0}
              />
              <StatCard
                label="Occupancy"
                value={stats.evacuation_centers?.total_occupancy ?? 0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
