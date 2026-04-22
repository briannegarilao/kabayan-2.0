// apps/web/app/dashboard/dev/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { createClient } from "../../../lib/supabase/client";
import { isDevConsoleEnabledForClient } from "../../../lib/dev-console";
import {
  getDevHealth,
  getDevLogs,
  getDevScenarios,
  getDevStateActive,
  getDevStats,
  postDevReset,
  postDevTripsClear,
  postForceResponderStatus,
  postRunDevScenario,
  postSeedSOS,
  postTripAccept,
  postTripDecline,
  postTripDropoff,
  postTripPickup,
} from "../../../lib/dev-api";

import { DevConsoleLayout } from "../../../components/dev/DevConsoleLayout";
import { BackendStatusPanel } from "../../../components/dev/BackendStatusPanel";
import { StatsPanel } from "../../../components/dev/StatsPanel";
import { SimulationPanel } from "../../../components/dev/SimulationPanel";
import { DatabaseControlPanel } from "../../../components/dev/DatabaseControlPanel";
import { ManualSOSForm } from "../../../components/dev/ManualSOSForm";
import { ResponderControlPanel } from "../../../components/dev/ResponderControlPanel";
import { TripControlPanel } from "../../../components/dev/TripControlPanel";
import { ScenarioRunnerPanel } from "../../../components/dev/ScenarioRunnerPanel";
import {
  DevUILog,
  LogFilter,
  LogPanel,
} from "../../../components/dev/LogPanel";
import {
  postSimulationAdvance,
  postSimulationAutoRun,
} from "../../../lib/dev-api";
import { SimulationRunnerPanel } from "../../../components/dev/SimulationRunnerPanel";

const supabase = createClient();

interface EvacSummary {
  total: number;
  open: number;
  closed: number;
}

interface ResultBannerState {
  type: "ok" | "err";
  msg: string;
}

function makeLogId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildBackendLogId(raw: any, index: number) {
  const trace = raw?.metadata?.run_id || raw?.metadata?.trace_id || "no-trace";
  const incident =
    raw?.metadata?.incident_id ||
    raw?.metadata?.primary_incident_id ||
    raw?.metadata?.seeded_from_incident_id ||
    "no-incident";
  const responder = raw?.metadata?.responder_id || "no-responder";
  const trip = raw?.metadata?.trip_id || "no-trip";
  const timestamp = raw?.timestamp ?? "no-ts";
  const source = raw?.source ?? "DEV";
  const event = raw?.event ?? "unknown";

  return [
    source,
    event,
    timestamp,
    trace,
    incident,
    responder,
    trip,
    index,
  ].join("__");
}

function normalizeBackendLog(raw: any, index: number): DevUILog {
  return {
    id: buildBackendLogId(raw, index),
    timestamp: raw?.timestamp ?? new Date().toISOString(),
    source: raw?.source ?? "DEV",
    level: raw?.level ?? "INFO",
    event: raw?.event ?? "unknown",
    message: raw?.message ?? "",
    metadata: raw?.metadata ?? {},
  };
}

function formatRealtimeMessage(table: string, eventType: string, payload: any) {
  const next = payload?.new ?? {};
  const old = payload?.old ?? {};

  if (table === "sos_incidents") {
    const status = next.status ?? old.status ?? "unknown";
    return {
      event: "realtime_sos",
      message: `[REALTIME] sos_incidents ${eventType} → status=${status}`,
      metadata: {
        table,
        eventType,
        id: next.id ?? old.id,
        status,
        barangay: next.barangay ?? old.barangay,
        is_simulated: next.is_simulated ?? old.is_simulated,
      },
    };
  }

  if (table === "trip_plans") {
    const status = next.status ?? old.status ?? "unknown";
    return {
      event: "realtime_trip",
      message: `[REALTIME] trip_plans ${eventType} → status=${status}`,
      metadata: {
        table,
        eventType,
        id: next.id ?? old.id,
        responder_id: next.responder_id ?? old.responder_id,
        status,
        is_simulated: next.is_simulated ?? old.is_simulated,
      },
    };
  }

  if (table === "responders") {
    return {
      event: "realtime_responder",
      message: `[REALTIME] responders ${eventType} → is_available=${String(
        next.is_available ?? old.is_available,
      )}`,
      metadata: {
        table,
        eventType,
        id: next.id ?? old.id,
        is_available: next.is_available ?? old.is_available,
        current_incident_id:
          next.current_incident_id ?? old.current_incident_id,
        current_load: next.current_load ?? old.current_load,
      },
    };
  }

  if (table === "evacuation_centers") {
    return {
      event: "realtime_evac",
      message: `[REALTIME] evacuation_centers ${eventType} → is_open=${String(
        next.is_open ?? old.is_open,
      )}`,
      metadata: {
        table,
        eventType,
        id: next.id ?? old.id,
        name: next.name ?? old.name,
        is_open: next.is_open ?? old.is_open,
        current_occupancy: next.current_occupancy ?? old.current_occupancy,
      },
    };
  }

  return {
    event: "realtime_generic",
    message: `[REALTIME] ${table} ${eventType}`,
    metadata: { table, eventType },
  };
}

export default function DevConsolePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ResultBannerState | null>(null);

  const [evacSummary, setEvacSummary] = useState<EvacSummary>({
    total: 0,
    open: 0,
    closed: 0,
  });

  const [health, setHealth] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [devState, setDevState] = useState<{
    responders: any[];
    active_incidents: any[];
    active_trips: any[];
  }>({
    responders: [],
    active_incidents: [],
    active_trips: [],
  });

  const [scenarioCatalog, setScenarioCatalog] = useState<any[]>([]);
  const [scenarioModes, setScenarioModes] = useState<
    Record<string, "setup_only" | "setup_and_trigger" | "full_run">
  >({});

  const [backendLogs, setBackendLogs] = useState<DevUILog[]>([]);
  const [realtimeLogs, setRealtimeLogs] = useState<DevUILog[]>([]);
  const [paused, setPaused] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>("ALL");

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        if (mounted) setAllowed(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const canOpen = isDevConsoleEnabledForClient(profile?.role ?? null);
      if (mounted) setAllowed(canOpen);
    }

    checkAccess();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshEvacSummary = useCallback(async () => {
    const [totalRes, openRes] = await Promise.all([
      supabase
        .from("evacuation_centers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("evacuation_centers")
        .select("id", { count: "exact", head: true })
        .eq("is_open", true),
    ]);

    const total = totalRes.count ?? 0;
    const open = openRes.count ?? 0;
    setEvacSummary({ total, open, closed: total - open });
  }, []);

  const refreshBackend = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        getDevHealth(),
        getDevStats(),
      ]);
      setHealth(healthRes);
      setStats(statsRes?.stats ?? null);
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Backend refresh failed: ${error.message}`,
      });
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const refreshDevState = useCallback(async () => {
    try {
      const res = await getDevStateActive();
      setDevState(
        res?.state ?? {
          responders: [],
          active_incidents: [],
          active_trips: [],
        },
      );
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `State refresh failed: ${error.message}`,
      });
    }
  }, []);

  const refreshScenarioCatalog = useCallback(async () => {
    try {
      const res = await getDevScenarios();
      const scenarios = res?.scenarios ?? [];
      setScenarioCatalog(scenarios);

      setScenarioModes((prev) => {
        const next = { ...prev };
        for (const item of scenarios) {
          if (!next[item.id]) {
            next[item.id] = "setup_and_trigger";
          }
        }
        return next;
      });
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Scenario catalog failed: ${error.message}`,
      });
    }
  }, []);

  const fetchBackendLogs = useCallback(async () => {
    try {
      const logRes = await getDevLogs({ n: 200 });
      const normalized = (logRes?.logs ?? []).map((item: any, index: number) =>
        normalizeBackendLog(item, index),
      );
      setBackendLogs(normalized);
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Log polling failed: ${error.message}`,
      });
    }
  }, []);

  useEffect(() => {
    if (allowed) {
      refreshEvacSummary();
      refreshBackend();
      refreshDevState();
      refreshScenarioCatalog();
      fetchBackendLogs();
    }
  }, [
    allowed,
    refreshBackend,
    refreshDevState,
    refreshEvacSummary,
    refreshScenarioCatalog,
    fetchBackendLogs,
  ]);

  useEffect(() => {
    if (!allowed || paused) return;

    const interval = setInterval(() => {
      fetchBackendLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [allowed, paused, fetchBackendLogs]);

  useEffect(() => {
    if (!allowed) return;

    const interval = setInterval(() => {
      refreshBackend();
      refreshDevState();
    }, 5000);

    return () => clearInterval(interval);
  }, [allowed, refreshBackend, refreshDevState]);

  useEffect(() => {
    if (!allowed) return;

    function pushRealtimeLog(table: string, eventType: string, payload: any) {
      const formatted = formatRealtimeMessage(table, eventType, payload);

      const entry: DevUILog = {
        id: makeLogId(`realtime_${table}`),
        timestamp: new Date().toISOString(),
        source: "REALTIME",
        level: "INFO",
        event: formatted.event,
        message: formatted.message,
        metadata: formatted.metadata,
      };

      setRealtimeLogs((prev) => [...prev, entry].slice(-200));
      refreshDevState();
      refreshBackend();
    }

    const channel = supabase
      .channel("dev-console-monitoring")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_incidents" },
        (payload) =>
          pushRealtimeLog("sos_incidents", payload.eventType, payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_plans" },
        (payload) => pushRealtimeLog("trip_plans", payload.eventType, payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responders" },
        (payload) => pushRealtimeLog("responders", payload.eventType, payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evacuation_centers" },
        (payload) =>
          pushRealtimeLog("evacuation_centers", payload.eventType, payload),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [allowed, refreshBackend, refreshDevState]);

  async function bulkOpenAllEvacs() {
    if (
      !confirm(
        "Open ALL evacuation centers? This will set is_open=true for every center.",
      )
    ) {
      return;
    }

    setBusy("open-all");
    setResult(null);

    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ is_open: true }, { count: "exact" })
      .eq("is_open", false);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({
      type: "ok",
      msg: `Opened ${count ?? "all"} previously-closed centers.`,
    });

    refreshEvacSummary();
    refreshBackend();
  }

  async function bulkCloseAllEvacs() {
    if (
      !confirm(
        "Close ALL evacuation centers? This will set is_open=false and reset current_occupancy to 0 for every center.",
      )
    ) {
      return;
    }

    setBusy("close-all");
    setResult(null);

    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ is_open: false, current_occupancy: 0 }, { count: "exact" })
      .eq("is_open", true);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({
      type: "ok",
      msg: `Closed ${count ?? "all"} previously-open centers and reset occupancy.`,
    });

    refreshEvacSummary();
    refreshBackend();
  }

  async function resetAllOccupancy() {
    if (!confirm("Reset current_occupancy to 0 for ALL evacuation centers?")) {
      return;
    }

    setBusy("reset-occ");
    setResult(null);

    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ current_occupancy: 0 }, { count: "exact" })
      .gt("current_occupancy", 0);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({
      type: "ok",
      msg: `Reset ${count ?? "all"} centers to 0 occupancy.`,
    });

    refreshEvacSummary();
    refreshBackend();
  }

  async function handleSoftReset() {
    if (
      !confirm(
        "Run SOFT reset? This preserves simulation history but resolves/cancels active simulated state.",
      )
    ) {
      return;
    }

    setBusy("soft-reset");
    setResult(null);

    try {
      await postDevReset("soft");
      setResult({ type: "ok", msg: "Soft reset complete." });
      await refreshBackend();
      await refreshEvacSummary();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Soft reset failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleFullReset() {
    if (
      !confirm(
        "Run FULL reset? This removes simulated rows and resets the environment. Continue?",
      )
    ) {
      return;
    }

    setBusy("full-reset");
    setResult(null);

    try {
      await postDevReset("full");
      setResult({ type: "ok", msg: "Full reset complete." });
      await refreshBackend();
      await refreshEvacSummary();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Full reset failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleSeedSingle() {
    setBusy("seed-single");
    setResult(null);

    try {
      await postSeedSOS({
        barangay: "Salitran III",
        count: 1,
        people_count: 3,
        vulnerability_flags: ["children"],
        message: "[SIM] Single SOS seeded from Dev Console",
        simulation_label: "part7-single-seed",
        cluster: false,
        run_engine_after_seed: true,
      });

      setResult({
        type: "ok",
        msg: "Seeded 1 simulated SOS and triggered the assignment engine.",
      });

      await refreshBackend();
      await refreshEvacSummary();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Seed single failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleSeedCluster() {
    setBusy("seed-cluster");
    setResult(null);

    try {
      await postSeedSOS({
        barangay: "Paliparan I",
        count: 3,
        people_count: 2,
        vulnerability_flags: [],
        message: "[SIM] Clustered SOS seeded from Dev Console",
        simulation_label: "part7-cluster-seed",
        cluster: true,
        run_engine_after_seed: true,
      });

      setResult({
        type: "ok",
        msg: "Seeded 3 clustered simulated SOS incidents.",
      });

      await refreshBackend();
      await refreshEvacSummary();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Seed cluster failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleManualSOS(payload: any) {
    setBusy("manual-sos");
    setResult(null);

    try {
      await postSeedSOS(payload);
      setResult({ type: "ok", msg: "Manual simulated SOS created." });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Manual SOS failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleForceResponder(payload: any) {
    setBusy("responder-force");
    setResult(null);

    try {
      await postForceResponderStatus(payload);
      setResult({ type: "ok", msg: "Responder override applied." });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Responder override failed: ${error.message}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleTripAccept(tripId: string) {
    setBusy("trip-accept");
    setResult(null);

    try {
      await postTripAccept(tripId);
      setResult({ type: "ok", msg: `Trip ${tripId} accepted.` });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Trip accept failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleTripDecline(payload: {
    tripId: string;
    reason: string;
    barangay?: string;
  }) {
    setBusy("trip-decline");
    setResult(null);

    try {
      await postTripDecline(payload);
      setResult({ type: "ok", msg: `Trip ${payload.tripId} declined.` });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Trip decline failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleTripPickup(payload: {
    tripId: string;
    incidentId: string;
    peoplePickedUp: number;
  }) {
    setBusy("trip-pickup");
    setResult(null);

    try {
      await postTripPickup(payload);
      setResult({
        type: "ok",
        msg: `Pickup recorded for incident ${payload.incidentId}.`,
      });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Pickup failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleTripDropoff(tripId: string) {
    setBusy("trip-dropoff");
    setResult(null);

    try {
      await postTripDropoff(tripId);
      setResult({ type: "ok", msg: `Dropoff recorded for trip ${tripId}.` });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Dropoff failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleTripsClear() {
    if (!confirm("Clear active simulated trips?")) return;

    setBusy("trips-clear");
    setResult(null);

    try {
      await postDevTripsClear();
      setResult({ type: "ok", msg: "Active simulated trips cleared." });
      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Trip clear failed: ${error.message}` });
    } finally {
      setBusy(null);
    }
  }

  function handleScenarioModeChange(
    scenarioId: string,
    mode: "setup_only" | "setup_and_trigger" | "full_run",
  ) {
    setScenarioModes((prev) => ({
      ...prev,
      [scenarioId]: mode,
    }));
  }

  async function handleRunScenario(scenarioId: string) {
    const mode = scenarioModes[scenarioId] ?? "setup_and_trigger";

    if (
      !confirm(
        `Run scenario "${scenarioId}" in mode "${mode}"? This will reset the simulation state first.`,
      )
    ) {
      return;
    }

    setBusy(`scenario-${scenarioId}`);
    setResult(null);

    try {
      const res = await postRunDevScenario({
        scenario_id: scenarioId,
        mode,
      });

      const note = res?.result?.full_run_note;
      setResult({
        type: "ok",
        msg: note
          ? `Scenario "${scenarioId}" completed. ${note}`
          : `Scenario "${scenarioId}" completed.`,
      });

      await refreshBackend();
      await refreshDevState();
      await refreshEvacSummary();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Scenario run failed: ${error.message}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleAdvanceSimulation(tripId?: string) {
    setBusy("sim-advance");
    setResult(null);

    try {
      const res = await postSimulationAdvance({
        trip_id: tripId,
        action: "auto_step",
      });

      setResult({
        type: "ok",
        msg: `Simulation step complete: ${res?.result?.action ?? "done"}.`,
      });

      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Simulation advance failed: ${error.message}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleAutoRunSimulation(payload?: {
    tripId?: string;
    maxSteps?: number;
  }) {
    setBusy("sim-auto-run");
    setResult(null);

    try {
      const res = await postSimulationAutoRun({
        trip_id: payload?.tripId,
        max_steps: payload?.maxSteps ?? 10,
      });

      setResult({
        type: "ok",
        msg: `Simulation auto-run completed in ${res?.result?.step_count ?? 0} step(s).`,
      });

      await refreshBackend();
      await refreshDevState();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({
        type: "err",
        msg: `Simulation auto-run failed: ${error.message}`,
      });
    } finally {
      setBusy(null);
    }
  }

  const combinedLogs = useMemo(() => {
    return [...backendLogs, ...realtimeLogs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [backendLogs, realtimeLogs]);

  function clearLocalLogs() {
    setRealtimeLogs([]);
    setBackendLogs([]);
  }

  if (allowed === null) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
        Checking Dev Console access...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-sm font-medium text-red-300">
          Dev Console unavailable
        </p>
        <p className="mt-1 text-xs text-red-400/80">
          This environment is not allowed to use the Dev Console.
        </p>
      </div>
    );
  }

  const banner = result ? (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
        result.type === "ok"
          ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-300"
          : "border-red-500/30 bg-red-400/10 text-red-300"
      }`}
    >
      {result.type === "ok" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{result.msg}</span>
    </div>
  ) : null;

  return (
    <DevConsoleLayout
      banner={banner}
      left={
        <>
          <SimulationPanel
            busy={busy}
            onSeedSingle={handleSeedSingle}
            onSeedCluster={handleSeedCluster}
          />

          <ManualSOSForm busy={busy} onSubmit={handleManualSOS} />

          <ResponderControlPanel
            responders={devState.responders}
            busy={busy}
            onSubmit={handleForceResponder}
          />

          <TripControlPanel
            trips={devState.active_trips}
            busy={busy}
            onAccept={handleTripAccept}
            onDecline={handleTripDecline}
            onPickup={handleTripPickup}
            onDropoff={handleTripDropoff}
            onClearTrips={handleTripsClear}
          />

          <ScenarioRunnerPanel
            scenarios={scenarioCatalog}
            busy={busy}
            selectedModes={scenarioModes}
            onModeChange={handleScenarioModeChange}
            onRunScenario={handleRunScenario}
          />

          <SimulationRunnerPanel
            trips={devState.active_trips.filter((trip) => trip.is_simulated)}
            busy={busy}
            onAdvanceOneStep={handleAdvanceSimulation}
            onAutoRun={handleAutoRunSimulation}
          />

          <DatabaseControlPanel
            evacSummary={evacSummary}
            busy={busy}
            onSoftReset={handleSoftReset}
            onFullReset={handleFullReset}
            onOpenAllEvacs={bulkOpenAllEvacs}
            onCloseAllEvacs={bulkCloseAllEvacs}
            onResetOccupancy={resetAllOccupancy}
            onClearTrips={handleTripsClear}
          />
        </>
      }
      right={
        <>
          <BackendStatusPanel
            health={health}
            loading={loadingHealth}
            onRefresh={() => {
              refreshBackend();
              refreshDevState();
            }}
          />

          <StatsPanel stats={stats} />

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="text-sm font-medium text-gray-200">
              Current State Snapshot
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Responders: {devState.responders.length} · Active trips:{" "}
              {devState.active_trips.length} · Active incidents:{" "}
              {devState.active_incidents.length}
            </p>

            <div className="mt-4 space-y-2 text-xs text-gray-400">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <p className="font-medium text-white">Active Incidents</p>
                <ul className="mt-2 space-y-1">
                  {devState.active_incidents.slice(0, 8).map((incident) => (
                    <li key={incident.id}>
                      {incident.id} · {incident.barangay} · {incident.status}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <p className="font-medium text-white">Active Trips</p>
                <ul className="mt-2 space-y-1">
                  {devState.active_trips.slice(0, 8).map((trip) => (
                    <li key={trip.id}>
                      {trip.id} · responder={trip.responder_id} · {trip.status}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <LogPanel
            logs={combinedLogs}
            filter={logFilter}
            setFilter={setLogFilter}
            paused={paused}
            onTogglePaused={() => setPaused((prev) => !prev)}
            onClearLocal={clearLocalLogs}
          />
        </>
      }
    />
  );
}
