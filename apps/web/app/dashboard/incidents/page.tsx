// apps/web/app/dashboard/incidents/page.tsx
"use client";

import { useState } from "react";
import { useRealtimeIncidents } from "../../../hooks/useRealtimeIncidents";
import { IncidentFilters } from "../../../components/incidents/IncidentFilters";
import { IncidentList } from "../../../components/incidents/IncidentList";
import { IncidentDetail } from "../../../components/incidents/IncidentDetail";
import type { SOSIncident } from "../../../lib/types";

export default function IncidentsPage() {
  const { incidents, isLoading } = useRealtimeIncidents();
  const [selectedIncident, setSelectedIncident] = useState<SOSIncident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Apply filters
  const filtered = incidents.filter((inc) => {
    if (statusFilter !== "all" && inc.status !== statusFilter) return false;
    if (severityFilter !== "all" && inc.flood_severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inc.barangay.toLowerCase().includes(q) ||
        (inc.message?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-5">
      {/* Left panel: filters + list */}
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 lg:w-2/3">
        <IncidentFilters
          statusFilter={statusFilter}
          severityFilter={severityFilter}
          searchQuery={searchQuery}
          onStatusChange={setStatusFilter}
          onSeverityChange={setSeverityFilter}
          onSearchChange={setSearchQuery}
          totalCount={incidents.length}
          filteredCount={filtered.length}
        />
        <IncidentList
          incidents={filtered}
          isLoading={isLoading}
          selectedId={selectedIncident?.id ?? null}
          onSelect={setSelectedIncident}
        />
      </div>

      {/* Right panel: detail view */}
      <div className="hidden w-1/3 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 lg:block">
        <IncidentDetail
          incident={selectedIncident}
          onStatusUpdate={() => {
            // Real-time subscription will auto-update the list
            setSelectedIncident(null);
          }}
        />
      </div>
    </div>
  );
}
