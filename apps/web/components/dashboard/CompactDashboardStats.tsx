"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Users, Building2, CloudRain } from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { useRealtimeIncidents } from "../../hooks/useRealtimeIncidents";

const supabase = createClient();

function CompactStatCard({
  label,
  value,
  icon: Icon,
  color,
  borderColor,
  bgColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400">{label}</p>
          <p className={`mt-1 text-lg font-semibold leading-none ${color}`}>
            {value}
          </p>
        </div>

        <Icon className={`h-5 w-5 shrink-0 ${color} opacity-70`} />
      </div>
    </div>
  );
}

export function CompactDashboardStats() {
  const { incidents } = useRealtimeIncidents();

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

    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = useMemo(
    () => incidents.filter((i) => i.status === "pending").length,
    [incidents],
  );

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.flood_severity === "critical").length,
    [incidents],
  );

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CompactStatCard
        label="Active Incidents"
        value={statsLoading ? "—" : stats.activeIncidents}
        icon={AlertTriangle}
        color="text-amber-400"
        bgColor="bg-amber-400/10"
        borderColor="border-amber-400/20"
      />

      <CompactStatCard
        label="Available Responders"
        value={statsLoading ? "—" : stats.availableResponders}
        icon={Users}
        color="text-blue-400"
        bgColor="bg-blue-400/10"
        borderColor="border-blue-400/20"
      />

      <CompactStatCard
        label="Open Evac Centers"
        value={statsLoading ? "—" : stats.openEvacCenters}
        icon={Building2}
        color="text-emerald-400"
        bgColor="bg-emerald-400/10"
        borderColor="border-emerald-400/20"
      />

      <CompactStatCard
        label="Pending / Critical"
        value={statsLoading ? "—" : `${pendingCount} / ${criticalCount}`}
        icon={CloudRain}
        color="text-red-400"
        bgColor="bg-red-400/10"
        borderColor="border-red-400/20"
      />
    </div>
  );
}
