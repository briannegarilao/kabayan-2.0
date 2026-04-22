// apps/web/app/dashboard/dev/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { createClient } from "../../../lib/supabase/client";
import { isDevConsoleEnabledForClient } from "../../../lib/dev-console";
import {
  getDevHealth,
  getDevLogs,
  getDevStats,
  postDevReset,
  postSeedSOS,
} from "../../../lib/dev-api";

import { DevConsoleLayout } from "../../../components/dev/DevConsoleLayout";
import { BackendStatusPanel } from "../../../components/dev/BackendStatusPanel";
import { StatsPanel } from "../../../components/dev/StatsPanel";
import { SimulationPanel } from "../../../components/dev/SimulationPanel";
import { DatabaseControlPanel } from "../../../components/dev/DatabaseControlPanel";
import {
  DevUILog,
  LogFilter,
  LogPanel,
} from "../../../components/dev/LogPanel";

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
      fetchBackendLogs();
    }
  }, [allowed, refreshBackend, refreshEvacSummary, fetchBackendLogs]);

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
    }, 5000);

    return () => clearInterval(interval);
  }, [allowed, refreshBackend]);

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
  }, [allowed]);

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
      const res = await postDevReset("soft");
      setResult({ type: "ok", msg: "Soft reset complete." });
      console.log("Soft reset result:", res);
      await refreshBackend();
      await refreshEvacSummary();
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
      const res = await postDevReset("full");
      setResult({ type: "ok", msg: "Full reset complete." });
      console.log("Full reset result:", res);
      await refreshBackend();
      await refreshEvacSummary();
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
      const res = await postSeedSOS({
        barangay: "Salitran III",
        count: 1,
        people_count: 3,
        vulnerability_flags: ["children"],
        message: "[SIM] Single SOS seeded from Dev Console",
        simulation_label: "part6-single-seed",
        cluster: false,
        run_engine_after_seed: true,
      });

      setResult({
        type: "ok",
        msg: "Seeded 1 simulated SOS and triggered the assignment engine.",
      });

      console.log("Seed single result:", res);
      await refreshBackend();
      await refreshEvacSummary();
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
      const res = await postSeedSOS({
        barangay: "Paliparan I",
        count: 3,
        people_count: 2,
        vulnerability_flags: [],
        message: "[SIM] Clustered SOS seeded from Dev Console",
        simulation_label: "part6-cluster-seed",
        cluster: true,
        run_engine_after_seed: true,
      });

      setResult({
        type: "ok",
        msg: "Seeded 3 clustered simulated SOS incidents.",
      });

      console.log("Seed cluster result:", res);
      await refreshBackend();
      await refreshEvacSummary();
      await fetchBackendLogs();
    } catch (error: any) {
      setResult({ type: "err", msg: `Seed cluster failed: ${error.message}` });
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

          <DatabaseControlPanel
            evacSummary={evacSummary}
            busy={busy}
            onSoftReset={handleSoftReset}
            onFullReset={handleFullReset}
            onOpenAllEvacs={bulkOpenAllEvacs}
            onCloseAllEvacs={bulkCloseAllEvacs}
            onResetOccupancy={resetAllOccupancy}
          />
        </>
      }
      right={
        <>
          <BackendStatusPanel
            health={health}
            loading={loadingHealth}
            onRefresh={refreshBackend}
          />

          <StatsPanel stats={stats} />

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
