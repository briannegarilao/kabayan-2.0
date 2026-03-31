// apps/web/components/incidents/IncidentList.tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { MapPin, Clock } from "lucide-react";
import { SEVERITY_COLORS, STATUS_CONFIG } from "../../lib/map-config";
import type { SOSIncident } from "../../lib/types";

interface Props {
  incidents: SOSIncident[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (inc: SOSIncident) => void;
}

export function IncidentList({ incidents, isLoading, selectedId, onSelect }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        No incidents match your filters.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 border-b border-gray-800 bg-gray-900 text-[10px] uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Barangay</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Message</th>
            <th className="px-4 py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => {
            const sevColor = SEVERITY_COLORS[inc.flood_severity || "pending"];
            const statusInfo = STATUS_CONFIG[inc.status] || STATUS_CONFIG.pending;
            const isSelected = inc.id === selectedId;

            return (
              <tr
                key={inc.id}
                onClick={() => onSelect(inc)}
                className={`cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-gray-800/50 ${
                  isSelected ? "bg-blue-600/10" : ""
                }`}
              >
                {/* Severity dot */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: sevColor }}
                    />
                    <span className="text-gray-400 capitalize">
                      {inc.flood_severity || "—"}
                    </span>
                  </div>
                </td>

                {/* Barangay */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-gray-600" />
                    <span className="font-medium text-gray-200">{inc.barangay}</span>
                  </div>
                </td>

                {/* Status badge */}
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}>
                    {statusInfo.label}
                  </span>
                </td>

                {/* Message preview */}
                <td className="max-w-[200px] truncate px-4 py-2.5 text-gray-500 italic">
                  {inc.message || "—"}
                </td>

                {/* Time ago */}
                <td className="px-4 py-2.5 text-right text-gray-500">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
