import { SEVERITY_COLORS } from "../../lib/map-config";
import type { EvacCenter, Responder, SOSIncident } from "./types";

export function buildSOSPopup(inc: SOSIncident): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "220px";
  const color = SEVERITY_COLORS[inc.flood_severity || "pending"];
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${inc.barangay}</div>
      <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}22;color:${color};">
          ${inc.flood_severity || "Assessing..."}
        </span>
        <span style="padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#374151;color:#d1d5db;">
          ${inc.status.replace("_", " ")}
        </span>
      </div>
      <div style="color:#9ca3af;margin-bottom:4px;">
        <strong>${inc.people_count ?? 1}</strong> ${(inc.people_count ?? 1) === 1 ? "person" : "people"}
      </div>
      ${inc.message ? `<div style="color:#9ca3af;font-style:italic;margin-bottom:4px;">"${inc.message}"</div>` : ""}
      <div style="color:#6b7280;font-size:11px;">
        ${new Date(inc.created_at).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>`;
  return el;
}

export function buildResponderPopup(r: Responder): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const loadPct =
    r.max_capacity && r.max_capacity > 0
      ? Math.round(((r.current_load ?? 0) / r.max_capacity) * 100)
      : 0;
  const statusColor = r.is_available ? "#22c55e" : "#f59e0b";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${r.team_name || "Responder"}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${r.vehicle_type || "—"}</div>
      ${r.home_barangay ? `<div style="color:#9ca3af;margin-bottom:4px;font-size:11px;">Home: ${r.home_barangay}</div>` : ""}
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${r.is_available ? "Available" : "On Trip"}</span>
      </div>
      <div style="color:#9ca3af;font-size:12px;">
        Load: <strong>${r.current_load ?? 0}/${r.max_capacity ?? 0}</strong> (${loadPct}%)
      </div>
    </div>`;
  return el;
}

export function buildEvacPopup(e: EvacCenter): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const capacity = e.capacity ?? 0;
  const occPct =
    capacity > 0 ? Math.round((e.current_occupancy / capacity) * 100) : 0;
  const statusColor = e.is_open ? "#14b8a6" : "#64748b";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${e.name}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${e.barangay}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${e.is_open ? "OPEN" : "Closed"}</span>
      </div>
      ${
        capacity > 0
          ? `<div style="color:#9ca3af;font-size:12px;">
        Occupancy: <strong>${e.current_occupancy}/${capacity}</strong> (${occPct}%)
      </div>`
          : ""
      }
    </div>`;
  return el;
}
