// apps/web/components/dev/TripControlPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type Trip = {
  id: string;
  responder_id?: string | null;
  status?: string | null;
  stops?: Array<any>;
  simulation_label?: string | null;
  is_simulated?: boolean | null;
};

export function TripControlPanel({
  trips,
  busy,
  onAccept,
  onDecline,
  onPickup,
  onDropoff,
  onClearTrips,
}: {
  trips: Trip[];
  busy: string | null;
  onAccept: (tripId: string) => Promise<void>;
  onDecline: (payload: {
    tripId: string;
    reason: string;
    barangay?: string;
  }) => Promise<void>;
  onPickup: (payload: {
    tripId: string;
    incidentId: string;
    peoplePickedUp: number;
  }) => Promise<void>;
  onDropoff: (tripId: string) => Promise<void>;
  onClearTrips: () => Promise<void>;
}) {
  const [selectedTripId, setSelectedTripId] = useState("");
  const [declineReason, setDeclineReason] = useState("unspecified");
  const [declineBarangay, setDeclineBarangay] = useState("");
  const [pickupIncidentId, setPickupIncidentId] = useState("");
  const [peoplePickedUp, setPeoplePickedUp] = useState(1);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId),
    [trips, selectedTripId],
  );

  const pickupStops = useMemo(() => {
    const stops = selectedTrip?.stops ?? [];
    return stops.filter(
      (stop: any) => stop?.type === "pickup" && stop?.incident_id,
    );
  }, [selectedTrip]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-200">Trip Controls</h3>
          <p className="mt-1 text-xs text-gray-500">
            Simulate responder trip lifecycle actions manually
          </p>
        </div>

        <button
          onClick={onClearTrips}
          disabled={busy !== null}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {busy === "trips-clear" ? "Clearing..." : "Clear Sim Trips"}
        </button>
      </div>

      <div className="space-y-3">
        <label className="space-y-1 block">
          <span className="text-xs text-gray-400">Select Active Trip</span>
          <select
            value={selectedTripId}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedTripId(next);
              setPickupIncidentId("");
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Choose trip...</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.id}{" "}
                {trip.simulation_label ? `· ${trip.simulation_label}` : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedTrip ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-xs text-gray-400">
            <p className="text-white font-medium">Trip {selectedTrip.id}</p>
            <p className="mt-1">
              Status: {selectedTrip.status} · Simulated:{" "}
              {String(selectedTrip.is_simulated)}
            </p>
            <p className="mt-1">Pickup stops: {pickupStops.length}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => selectedTripId && onAccept(selectedTripId)}
            disabled={busy !== null || !selectedTripId}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "trip-accept" ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Accept"
            )}
          </button>

          <button
            onClick={() => selectedTripId && onDropoff(selectedTripId)}
            disabled={busy !== null || !selectedTripId}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === "trip-dropoff" ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Dropoff"
            )}
          </button>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
            Decline Trip
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="route_blocked / off_duty / other"
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
            <input
              value={declineBarangay}
              onChange={(e) => setDeclineBarangay(e.target.value)}
              placeholder="Barangay (optional for route_blocked)"
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            onClick={() =>
              selectedTripId &&
              onDecline({
                tripId: selectedTripId,
                reason: declineReason,
                barangay: declineBarangay || undefined,
              })
            }
            disabled={busy !== null || !selectedTripId}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {busy === "trip-decline" ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Decline"
            )}
          </button>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
            Pickup Stop
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={pickupIncidentId}
              onChange={(e) => setPickupIncidentId(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Select pickup incident...</option>
              {pickupStops.map((stop: any) => (
                <option key={stop.incident_id} value={stop.incident_id}>
                  {stop.incident_id} · {stop.people_count ?? "?"} people
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              value={peoplePickedUp}
              onChange={(e) => setPeoplePickedUp(Number(e.target.value))}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            onClick={() =>
              selectedTripId &&
              pickupIncidentId &&
              onPickup({
                tripId: selectedTripId,
                incidentId: pickupIncidentId,
                peoplePickedUp,
              })
            }
            disabled={busy !== null || !selectedTripId || !pickupIncidentId}
            className="mt-3 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {busy === "trip-pickup" ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Mark Pickup"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
