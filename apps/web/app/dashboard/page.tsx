// apps/web/app/dashboard/page.tsx
// This REPLACES your existing dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Users,
  Building2,
  CloudRain,
  RefreshCw,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useRealtimeIncidents } from "../../hooks/useRealtimeIncidents";
import KabayanMap from "../../components/map/KabayanMap";
import { IncidentTable } from "../../components/dashboard/IncidentTable";

const supabase = createClient();

// Stat card component — extracted to avoid repetition
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className={`mt-0.5 text-xl font-bold ${color}`}>{value}</p>
        </div>
        <Icon className={`h-7 w-7 ${color} opacity-40`} />
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const { incidents, isLoading } = useRealtimeIncidents();

  // Summary stats — fetched once, cached in state
  const [stats, setStats] = useState({
    activeIncidents: 0,
    availableResponders: 0,
    openEvacCenters: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [incidentRes, responderRes, evacRes] = await Promise.all([
        supabase
          .from("sos_incidents")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "assigned", "in_progress"]),
        supabase
          .from("responders")
          .select("id", { count: "exact", head: true })
          .eq("is_available", true),
        supabase
          .from("evacuation_centers")
          .select("id", { count: "exact", head: true })
          .eq("is_open", true),
      ]);

      setStats({
        activeIncidents: incidentRes.count ?? 0,
        availableResponders: responderRes.count ?? 0,
        openEvacCenters: evacRes.count ?? 0,
      });
      setStatsLoading(false);
    }

    fetchStats();

    // Refresh stats every 5 minutes — not on every render
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Derive active count from real-time data (always up to date)
  const pendingCount = incidents.filter((i) => i.status === "pending").length;
  const criticalCount = incidents.filter(
    (i) => i.flood_severity === "critical"
  ).length;

  return (
    <div className="space-y-5">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active Incidents"
          value={statsLoading ? "—" : stats.activeIncidents}
          icon={AlertTriangle}
          color="text-amber-400"
          bgColor="bg-amber-400/10"
          borderColor="border-amber-400/20"
        />
        <StatCard
          label="Available Responders"
          value={statsLoading ? "—" : stats.availableResponders}
          icon={Users}
          color="text-blue-400"
          bgColor="bg-blue-400/10"
          borderColor="border-blue-400/20"
        />
        <StatCard
          label="Open Evac Centers"
          value={statsLoading ? "—" : stats.openEvacCenters}
          icon={Building2}
          color="text-emerald-400"
          bgColor="bg-emerald-400/10"
          borderColor="border-emerald-400/20"
        />
        <StatCard
          label="Pending / Critical"
          value={
            statsLoading
              ? "—"
              : `${pendingCount} / ${criticalCount}`
          }
          icon={CloudRain}
          color="text-red-400"
          bgColor="bg-red-400/10"
          borderColor="border-red-400/20"
        />
      </div>

      {/* Main content: Map + Incident list */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Map — takes 2/3 width on desktop */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-300">
              Live Incident Map — Dasmariñas
            </h3>
            <div className="flex items-center gap-3">
              {/* Severity legend */}
              <div className="hidden items-center gap-2 sm:flex">
                {(["low", "moderate", "high", "critical"] as const).map(
                  (level) => (
                    <div
                      key={level}
                      className="flex items-center gap-1 text-[10px] text-gray-500"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            level === "low"
                              ? "#22c55e"
                              : level === "moderate"
                              ? "#f59e0b"
                              : level === "high"
                              ? "#f97316"
                              : "#ef4444",
                        }}
                      />
                      {level}
                    </div>
                  )
                )}
              </div>
              <span className="text-[10px] text-gray-600">
                {incidents.length} active
              </span>
            </div>
          </div>
          <div className="h-[500px]">
            <KabayanMap incidents={incidents} className="h-full w-full" />
          </div>
        </div>

        {/* Incident list — 1/3 width */}
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-300">
              SOS Reports
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-[500px] overflow-y-auto p-3">
            <IncidentTable
              incidents={incidents}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
