import L from "leaflet";
import { SEVERITY_COLORS } from "../../lib/map-config";

export function createSOSIcon(
  severity: string | null,
  isCritical: boolean,
): L.DivIcon {
  const color =
    SEVERITY_COLORS[severity || "pending"] || SEVERITY_COLORS.pending;

  const halo =
    severity === "critical"
      ? "0 0 0 5px rgba(239,68,68,0.22), 0 0 20px rgba(239,68,68,0.55)"
      : severity === "high"
        ? "0 0 0 4px rgba(249,115,22,0.18), 0 0 16px rgba(249,115,22,0.45)"
        : severity === "moderate"
          ? "0 0 0 4px rgba(245,158,11,0.16), 0 0 14px rgba(245,158,11,0.35)"
          : "0 0 0 4px rgba(34,197,94,0.14), 0 0 12px rgba(34,197,94,0.25)";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:28px;
        height:28px;
        border-radius:50%;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:${halo};
        display:flex;
        align-items:center;
        justify-content:center;
        ${isCritical ? "animation:kabayan-pulse 1.35s infinite;" : ""}
      ">
        <div style="
          width:8px;
          height:8px;
          border-radius:50%;
          background:white;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function createResponderIcon(isAvailable: boolean): L.DivIcon {
  const color = isAvailable ? "#22c55e" : "#f59e0b";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:28px;
        height:28px;
        border-radius:8px;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:0 0 0 4px ${isAvailable ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.16)"}, 0 4px 12px rgba(0,0,0,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:800;
        font-size:12px;
      ">R</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function createEvacIcon(isOpen: boolean): L.DivIcon {
  const color = isOpen ? "#0d9488" : "#475569";
  const glow = isOpen
    ? "0 0 0 4px rgba(20,184,166,0.14), 0 4px 12px rgba(0,0,0,0.45)"
    : "0 0 0 4px rgba(100,116,139,0.14), 0 4px 12px rgba(0,0,0,0.45)";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:30px;
        height:30px;
        border-radius:8px;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:${glow};
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="position:relative;width:14px;height:14px;">
          <div style="
            position:absolute;
            left:5px;
            top:0;
            width:4px;
            height:14px;
            background:white;
            border-radius:2px;
          "></div>
          <div style="
            position:absolute;
            left:0;
            top:5px;
            width:14px;
            height:4px;
            background:white;
            border-radius:2px;
          "></div>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}
