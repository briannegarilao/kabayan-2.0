"use client";

import {
  AlertTriangle,
  Users,
  Building2,
  Flame,
  Activity,
  Search,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { SEVERITY_COLORS } from "../../lib/map-config";
import type { EvacCenter, Responder, SOSIncident, TabId } from "./types";

interface MapSidePanelProps {
  selectedBarangay: string | null;
  showSOS: boolean;
  setShowSOS: (v: boolean) => void;
  showResponders: boolean;
  setShowResponders: (v: boolean) => void;
  showEvacs: boolean;
  setShowEvacs: (v: boolean) => void;
  showTrips: boolean;
  setShowTrips: (v: boolean) => void;
  showBarangays: boolean;
  setShowBarangays: (v: boolean) => void;
  heatmapMode: boolean;
  setHeatmapMode: (v: boolean) => void;
  sosStatusFilter: string;
  setSosStatusFilter: (v: string) => void;
  activeTab: TabId;
  setActiveTab: (v: TabId) => void;
  listSearch: string;
  setListSearch: (v: string) => void;
  filteredIncidents: SOSIncident[];
  filteredResponders: Responder[];
  filteredEvacs: EvacCenter[];
  respondersCount: number;
  evacCentersCount: number;
  activeTripsCount: number;
  barangayFeatureCount: number | string;
  highlightedId: string | null;
  onFocusSOS: (id: string) => void;
  onFocusResponder: (id: string) => void;
  onFocusEvac: (id: string) => void;
  onViewSOS: (id: string) => void;
  onViewResponder: (id: string) => void;
  onViewEvac: (id: string) => void;
}

export function MapSidePanel({
  selectedBarangay,
  showSOS,
  setShowSOS,
  showResponders,
  setShowResponders,
  showEvacs,
  setShowEvacs,
  showTrips,
  setShowTrips,
  showBarangays,
  setShowBarangays,
  heatmapMode,
  setHeatmapMode,
  sosStatusFilter,
  setSosStatusFilter,
  activeTab,
  setActiveTab,
  listSearch,
  setListSearch,
  filteredIncidents,
  filteredResponders,
  filteredEvacs,
  respondersCount,
  evacCentersCount,
  activeTripsCount,
  barangayFeatureCount,
  highlightedId,
  onFocusSOS,
  onFocusResponder,
  onFocusEvac,
  onViewSOS,
  onViewResponder,
  onViewEvac,
}: MapSidePanelProps) {
  const activeCounts = {
    sos: filteredIncidents.length,
    responders: filteredResponders.length,
    evacs: filteredEvacs.length,
  };

  return (
    <div className="absolute left-4 top-4 bottom-4 z-[1000] flex w-80 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/95 shadow-2xl backdrop-blur">
      <div className="border-b border-gray-800 p-4">
        {selectedBarangay && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-2.5 py-1.5 text-xs text-blue-300">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Focused: {selectedBarangay}</span>
          </div>
        )}

        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Map Layers
        </h3>

        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showSOS}
              onChange={(e) => setShowSOS(e.target.checked)}
              className="h-4 w-4 rounded accent-red-500"
            />
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>SOS Incidents</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {activeCounts.sos}
            </span>
          </label>

          {showSOS && (
            <div className="ml-6">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={heatmapMode}
                  onChange={(e) => setHeatmapMode(e.target.checked)}
                  className="h-3 w-3 rounded accent-orange-500"
                />
                <Flame className="h-3 w-3 text-orange-400" />
                Heatmap mode
              </label>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showResponders}
              onChange={(e) => setShowResponders(e.target.checked)}
              className="h-4 w-4 rounded accent-amber-500"
            />
            <Users className="h-4 w-4 text-amber-400" />
            <span>Responders</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {respondersCount}
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showEvacs}
              onChange={(e) => setShowEvacs(e.target.checked)}
              className="h-4 w-4 rounded accent-teal-500"
            />
            <Building2 className="h-4 w-4 text-teal-400" />
            <span>Evac Centers</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {evacCentersCount}
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showTrips}
              onChange={(e) => setShowTrips(e.target.checked)}
              className="h-4 w-4 rounded accent-purple-500"
            />
            <Activity className="h-4 w-4 text-purple-400" />
            <span>Active Routes</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {activeTripsCount}
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showBarangays}
              onChange={(e) => setShowBarangays(e.target.checked)}
              className="h-4 w-4 rounded accent-slate-500"
            />
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>Barangay Outlines</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {barangayFeatureCount}
            </span>
          </label>
        </div>

        {showSOS && (
          <div className="mt-3 border-t border-gray-800 pt-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              SOS Status
            </label>
            <select
              value={sosStatusFilter}
              onChange={(e) => setSosStatusFilter(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
            >
              <option value="active">
                Active (pending/assigned/in progress)
              </option>
              <option value="pending">Pending only</option>
              <option value="assigned">Assigned only</option>
              <option value="in_progress">In Progress only</option>
              <option value="all">All (including resolved)</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-gray-800">
          <TabButton
            active={activeTab === "sos"}
            onClick={() => setActiveTab("sos")}
            label="SOS"
            count={activeCounts.sos}
            color="text-red-400"
          />
          <TabButton
            active={activeTab === "responders"}
            onClick={() => setActiveTab("responders")}
            label="Responders"
            count={activeCounts.responders}
            color="text-amber-400"
          />
          <TabButton
            active={activeTab === "evacs"}
            onClick={() => setActiveTab("evacs")}
            label="Evacs"
            count={activeCounts.evacs}
            color="text-teal-400"
          />
        </div>

        <div className="relative border-b border-gray-800 p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border border-gray-700 bg-gray-800 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "sos" &&
            (filteredIncidents.length === 0 ? (
              <EmptyState message="No SOS incidents" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {filteredIncidents.map((inc) => (
                  <SOSListItem
                    key={inc.id}
                    incident={inc}
                    highlighted={highlightedId === inc.id}
                    onFocus={() => onFocusSOS(inc.id)}
                    onViewDetails={() => onViewSOS(inc.id)}
                  />
                ))}
              </ul>
            ))}

          {activeTab === "responders" &&
            (filteredResponders.length === 0 ? (
              <EmptyState message="No responders" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {filteredResponders.map((r) => (
                  <ResponderListItem
                    key={r.id}
                    responder={r}
                    highlighted={highlightedId === r.id}
                    onFocus={() => onFocusResponder(r.id)}
                    onViewDetails={() => onViewResponder(r.id)}
                  />
                ))}
              </ul>
            ))}

          {activeTab === "evacs" &&
            (filteredEvacs.length === 0 ? (
              <EmptyState message="No evacuation centers" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {filteredEvacs.map((e) => (
                  <EvacListItem
                    key={e.id}
                    evac={e}
                    highlighted={highlightedId === e.id}
                    onFocus={() => onFocusEvac(e.id)}
                    onViewDetails={() => onViewEvac(e.id)}
                  />
                ))}
              </ul>
            ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors ${
        active
          ? `border-blue-500 ${color}`
          : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
      <span className="ml-1 text-[10px] text-gray-500">({count})</span>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center px-4 text-center">
      <MapPin className="mb-2 h-6 w-6 text-gray-700" />
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  );
}

function SOSListItem({
  incident,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  incident: SOSIncident;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = SEVERITY_COLORS[incident.flood_severity || "pending"];

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {incident.barangay}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="capitalize">
                {incident.flood_severity || "assessing"}
              </span>
              <span>•</span>
              <span>{incident.status.replace("_", " ")}</span>
              <span>•</span>
              <span>{incident.people_count ?? 1}p</span>
            </div>
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function ResponderListItem({
  responder,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  responder: Responder;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = responder.is_available ? "#22c55e" : "#f59e0b";
  const loadPct =
    responder.max_capacity && responder.max_capacity > 0
      ? Math.round(
          ((responder.current_load ?? 0) / responder.max_capacity) * 100,
        )
      : 0;

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {responder.team_name || "Responder"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span>{responder.vehicle_type || "—"}</span>
              <span>•</span>
              <span>{responder.is_available ? "Available" : "On Trip"}</span>
              <span>•</span>
              <span>Load {loadPct}%</span>
            </div>
            {responder.home_barangay && (
              <div className="mt-0.5 text-[10px] text-gray-600">
                {responder.home_barangay}
              </div>
            )}
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function EvacListItem({
  evac,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  evac: EvacCenter;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = evac.is_open ? "#14b8a6" : "#64748b";
  const capacity = evac.capacity ?? 0;

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {evac.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="truncate">{evac.barangay}</span>
              <span>•</span>
              <span
                className={evac.is_open ? "text-teal-400" : "text-gray-500"}
              >
                {evac.is_open ? "OPEN" : "Closed"}
              </span>
              {capacity > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {evac.current_occupancy}/{capacity}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
