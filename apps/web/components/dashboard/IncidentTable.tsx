// apps/web/components/dashboard/IncidentTable.tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock, MapPin } from "lucide-react";
import { SEVERITY_COLORS, STATUS_CONFIG } from "../../lib/map-config";
import type { SOSIncident } from "../../lib/types";

interface IncidentTableProps {
  incidents: SOSIncident[];
  isLoading: boolean;
  onSelectIncident?: (incident: SOSIncident) => void;
}

export function IncidentTable({
  incidents,
  isLoading,
  onSelectIncident,
}: IncidentTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <p className="text-xs text-gray-500">Loading incidents...</p>
        </div>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <AlertTriangle className="mb-2 h-8 w-8 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">No active incidents</p>
        <p className="text-xs text-gray-600">
          SOS reports will appear here in real-time
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto">
      {incidents.map((incident) => {
        const severityColor =
          SEVERITY_COLORS[incident.flood_severity || "pending"];
        const statusInfo =
          STATUS_CONFIG[incident.status] || STATUS_CONFIG.pending;

        const timeAgo = formatDistanceToNow(new Date(incident.created_at), {
          addSuffix: true,
        });

        return (
          <button
            key={incident.id}
            onClick={() => onSelectIncident?.(incident)}
            className="w-full rounded-lg border border-gray-800 bg-gray-800/50 p-3 text-left transition-colors hover:border-gray-700 hover:bg-gray-800"
          >
            {/* Top row: barangay + severity */}
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-gray-500" />
                <span className="text-sm font-medium text-gray-200">
                  {incident.barangay}
                </span>
              </div>
              {/* Severity dot */}
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: severityColor }}
                title={incident.flood_severity || "Assessing"}
              />
            </div>

            {/* Status badge + time */}
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}
              >
                {statusInfo.label}
              </span>
              {incident.flood_severity && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: severityColor,
                    backgroundColor: `${severityColor}18`,
                  }}
                >
                  {incident.flood_severity}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo}
              </span>
            </div>

            {/* Message preview */}
            {incident.message && (
              <p className="mt-1.5 truncate text-xs text-gray-500 italic">
                &ldquo;{incident.message}&rdquo;
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
