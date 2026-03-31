// apps/web/components/incidents/IncidentDetail.tsx
"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { MapPin, Clock, AlertTriangle, User, Phone, Loader2, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { SEVERITY_COLORS, STATUS_CONFIG } from "../../lib/map-config";
import type { SOSIncident } from "../../lib/types";

const supabase = createClient();

interface Props {
  incident: SOSIncident | null;
  onStatusUpdate: () => void;
}

export function IncidentDetail({ incident, onStatusUpdate }: Props) {
  const [updating, setUpdating] = useState(false);

  if (!incident) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">Select an incident to view details</p>
        </div>
      </div>
    );
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "resolved" || newStatus === "false_alarm") {
      updateData.resolved_at = new Date().toISOString();
    }
    if (newStatus === "assigned") {
      updateData.assigned_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("sos_incidents")
      .update(updateData)
      .eq("id", incident.id);

    setUpdating(false);

    if (error) {
      console.error("Failed to update status:", error.message);
      alert("Failed to update: " + error.message);
      return;
    }

    onStatusUpdate();
  }

  const sevColor = SEVERITY_COLORS[incident.flood_severity || "pending"];
  const statusInfo = STATUS_CONFIG[incident.status] || STATUS_CONFIG.pending;

  // Available next statuses based on current
  const nextStatuses: { label: string; value: string; color: string }[] = [];
  if (incident.status === "pending") {
    nextStatuses.push({ label: "Assign", value: "assigned", color: "bg-blue-600 hover:bg-blue-700" });
    nextStatuses.push({ label: "False Alarm", value: "false_alarm", color: "bg-gray-600 hover:bg-gray-700" });
  }
  if (incident.status === "assigned") {
    nextStatuses.push({ label: "Start Response", value: "in_progress", color: "bg-purple-600 hover:bg-purple-700" });
  }
  if (incident.status === "in_progress") {
    nextStatuses.push({ label: "Resolve", value: "resolved", color: "bg-emerald-600 hover:bg-emerald-700" });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{incident.barangay}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusInfo.color} ${statusInfo.bgColor}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-gray-500 font-mono">ID: {incident.id.slice(0, 8)}...</p>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {/* Severity */}
        <div>
          <p className="mb-1 text-[10px] uppercase text-gray-500">Flood Severity</p>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: sevColor }} />
            <span className="text-sm font-medium capitalize text-gray-200">
              {incident.flood_severity || "Assessing..."}
            </span>
            {incident.flood_severity_score != null && (
              <span className="text-[10px] text-gray-500">
                ({(incident.flood_severity_score * 100).toFixed(0)}% confidence)
              </span>
            )}
          </div>
        </div>

        {/* Message */}
        {incident.message && (
          <div>
            <p className="mb-1 text-[10px] uppercase text-gray-500">Message</p>
            <p className="text-sm text-gray-300 italic">&ldquo;{incident.message}&rdquo;</p>
          </div>
        )}

        {/* Time */}
        <div>
          <p className="mb-1 text-[10px] uppercase text-gray-500">Reported</p>
          <div className="flex items-center gap-1.5 text-sm text-gray-300">
            <Clock className="h-3.5 w-3.5 text-gray-500" />
            {format(new Date(incident.created_at), "MMM d, yyyy 'at' h:mm a")}
          </div>
          <p className="mt-0.5 text-[10px] text-gray-500">
            {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Image */}
        {incident.image_url && (
          <div>
            <p className="mb-1 text-[10px] uppercase text-gray-500">Photo Evidence</p>
            <img
              src={incident.image_url}
              alt="Incident"
              className="w-full rounded-lg border border-gray-700 object-cover"
              style={{ maxHeight: "200px" }}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      {nextStatuses.length > 0 && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-2">
            {nextStatuses.map((action) => (
              <button
                key={action.value}
                onClick={() => updateStatus(action.value)}
                disabled={updating}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${action.color}`}
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
