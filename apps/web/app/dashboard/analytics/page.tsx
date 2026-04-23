"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  BarChart3,
  CloudRain,
  GitBranch,
  MapPin,
  Radar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { ARIMAChart } from "../../../components/analytics/ARIMAChart";
import { DBSCANView } from "../../../components/analytics/DBSCANView";
import { AprioriView } from "../../../components/analytics/AprioriView";
import type { DBSCANPayload } from "../../../components/analytics/DBSCANMap";

const DBSCANMap = dynamic(
  () => import("../../../components/analytics/DBSCANMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    ),
  }
);

const supabase = createClient();

type AnalyticsTab = "overview" | "rainfall" | "clusters" | "patterns";

interface MLResult {
  model_type: string;
  result_json: unknown;
  computed_at: string;
}

interface ForecastPoint {
  date: string;
  actual?: number;
  predicted?: number;
}

interface ArimaPayload {
  forecast?: ForecastPoint[];
  model?: string;
  model_info?: string;
}

interface DBSCANCluster {
  cluster_id: number;
  barangay?: string;
  incident_count?: number;
}

interface AprioriRuleInput {
  rule_id?: number;
  antecedent?: string;
  consequent?: string;
  condition?: string;
  result?: string;
  support?: number;
  confidence?: number;
  lift?: number;
}

interface AprioriPayload {
  city?: string;
  generated_at?: string;
  rules_count?: number;
  rules?: AprioriRuleInput[];
}

interface NormalizedAprioriRule {
  ruleId: number | null;
  condition: string;
  result: string;
  support: number;
  confidence: number;
  lift: number;
}

function formatDate(value?: string) {
  if (!value) return "No data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No data";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "No data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No data";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value?: number, digits = 0, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function parseArimaPayload(data: unknown): ForecastPoint[] {
  const payload = data as ArimaPayload | null;
  if (!payload || !Array.isArray(payload.forecast)) return [];

  return payload.forecast
    .filter((point) => point && typeof point.date === "string")
    .map((point) => ({
      date: point.date,
      actual: typeof point.actual === "number" ? point.actual : undefined,
      predicted: typeof point.predicted === "number" ? point.predicted : undefined,
    }));
}

function normalizeAprioriRule(rule: AprioriRuleInput): NormalizedAprioriRule {
  return {
    ruleId: typeof rule.rule_id === "number" ? rule.rule_id : null,
    condition: rule.condition ?? rule.antecedent ?? "—",
    result: rule.result ?? rule.consequent ?? "—",
    support: typeof rule.support === "number" ? rule.support : 0,
    confidence: typeof rule.confidence === "number" ? rule.confidence : 0,
    lift: typeof rule.lift === "number" ? rule.lift : 0,
  };
}

function getPeakForecastDay(points: ForecastPoint[]) {
  return points.reduce<ForecastPoint | null>((peak, point) => {
    if (typeof point.predicted !== "number") return peak;
    if (!peak || (peak.predicted ?? -Infinity) < point.predicted) return point;
    return peak;
  }, null);
}

function getLatestActual(points: ForecastPoint[]) {
  return [...points]
    .reverse()
    .find((point) => typeof point.actual === "number");
}

function getAveragePredicted(points: ForecastPoint[]) {
  const predicted = points
    .map((point) => point.predicted)
    .filter((value): value is number => typeof value === "number");

  if (predicted.length === 0) return null;
  return predicted.reduce((sum, value) => sum + value, 0) / predicted.length;
}

function getTopCluster(clusters: DBSCANCluster[]) {
  return [...clusters].sort(
    (a, b) => (b.incident_count ?? 0) - (a.incident_count ?? 0)
  )[0] ?? null;
}

function buildInsightCards(input: {
  arimaPoints: ForecastPoint[];
  dbscanClusters: DBSCANCluster[];
  aprioriRules: NormalizedAprioriRule[];
}) {
  const peakForecast = getPeakForecastDay(input.arimaPoints);
  const topCluster = getTopCluster(input.dbscanClusters);
  const strongestRule = [...input.aprioriRules].sort((a, b) => b.lift - a.lift)[0];

  return [
    {
      title: "Rainfall Outlook",
      body: peakForecast
        ? `Forecast intensity peaks on ${formatDate(peakForecast.date)} at ${formatNumber(peakForecast.predicted, 1, " mm")}.`
        : "No rainfall forecast is available yet from the latest ARIMA run.",
    },
    {
      title: "Hotspot Focus",
      body: topCluster
        ? `${topCluster.barangay ?? "Unknown barangay"} currently leads the clustering output with ${formatNumber(topCluster.incident_count)} incidents.`
        : "No DBSCAN hotspot cluster is available from the current analytics snapshot.",
    },
    {
      title: "Weather Association",
      body: strongestRule
        ? `${strongestRule.condition} is strongly linked with ${strongestRule.result} at lift ${formatNumber(strongestRule.lift, 2)}.`
        : "No Apriori association rules are available to summarize yet.",
    },
  ];
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{caption ?? "—"}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  icon,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/85 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
          </div>
          {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-950/40 px-6 text-center">
      <p className="text-sm font-medium text-gray-300">{title}</p>
      <p className="mt-2 max-w-lg text-xs text-gray-500">{body}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [results, setResults] = useState<Record<string, MLResult | null>>({
    arima: null,
    dbscan: null,
    apriori: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  useEffect(() => {
    async function fetchML() {
      const [arimaRes, dbscanRes, aprioriRes] = await Promise.all([
        supabase.from("ml_results").select("model_type, result_json, computed_at")
          .eq("model_type", "arima").order("computed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("ml_results").select("model_type, result_json, computed_at")
          .eq("model_type", "dbscan").order("computed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("ml_results").select("model_type, result_json, computed_at")
          .eq("model_type", "apriori").order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setResults({
        arima: arimaRes.data as MLResult | null,
        dbscan: dbscanRes.data as MLResult | null,
        apriori: aprioriRes.data as MLResult | null,
      });
      setIsLoading(false);
    }

    fetchML();
  }, []);

  const arimaForecast = useMemo(
    () => parseArimaPayload(results.arima?.result_json),
    [results.arima?.result_json]
  );

  const dbscanData = useMemo(
    () => (results.dbscan?.result_json as DBSCANPayload | null) ?? null,
    [results.dbscan?.result_json]
  );

  const dbscanClusters = useMemo(
    () => (Array.isArray(dbscanData?.clusters) ? dbscanData.clusters : []),
    [dbscanData]
  );

  const aprioriPayload = useMemo(
    () => (results.apriori?.result_json as AprioriPayload | null) ?? null,
    [results.apriori?.result_json]
  );

  const aprioriRules = useMemo(
    () => (aprioriPayload?.rules ?? []).map(normalizeAprioriRule),
    [aprioriPayload]
  );

  const arimaMetrics = useMemo(() => {
    const peakForecast = getPeakForecastDay(arimaForecast);
    const latestActual = getLatestActual(arimaForecast);
    const averagePredicted = getAveragePredicted(arimaForecast);

    return {
      pointCount: arimaForecast.length,
      latestActual: latestActual?.actual ?? null,
      latestActualDate: latestActual?.date,
      highestPredicted: peakForecast?.predicted ?? null,
      highestPredictedDate: peakForecast?.date,
      averagePredicted,
      latestComputedAt: results.arima?.computed_at,
      modelLabel:
        (results.arima?.result_json as ArimaPayload | undefined)?.model ??
        (results.arima?.result_json as ArimaPayload | undefined)?.model_info ??
        null,
      preview: arimaForecast.slice(0, 4),
    };
  }, [arimaForecast, results.arima?.computed_at, results.arima?.result_json]);

  const dbscanMetrics = useMemo(() => {
    const topCluster = getTopCluster(dbscanClusters);
    const totalIncidents = dbscanClusters.reduce(
      (sum, cluster) => sum + (cluster.incident_count ?? 0),
      0
    );

    return {
      clusterCount: dbscanClusters.length,
      topHotspot: topCluster?.barangay ?? null,
      topIncidentCount: topCluster?.incident_count ?? null,
      silhouetteScore:
        typeof dbscanData?.silhouette_score === "number"
          ? dbscanData.silhouette_score
          : null,
      noiseCount:
        typeof dbscanData?.noise_count === "number" ? dbscanData.noise_count : null,
      totalIncidents,
      latestComputedAt: results.dbscan?.computed_at,
      hasMapData:
        Array.isArray(dbscanData?.clusters) &&
        dbscanData.clusters.some(
          (cluster) => Array.isArray(cluster.points) && cluster.points.length > 0
        ),
    };
  }, [dbscanClusters, dbscanData, results.dbscan?.computed_at]);

  const aprioriMetrics = useMemo(() => {
    const byConfidence = [...aprioriRules].sort((a, b) => b.confidence - a.confidence);
    const byLift = [...aprioriRules].sort((a, b) => b.lift - a.lift);

    return {
      rulesCount:
        typeof aprioriPayload?.rules_count === "number"
          ? aprioriPayload.rules_count
          : aprioriRules.length,
      strongestLift: byLift[0]?.lift ?? null,
      strongestConfidence: byConfidence[0]?.confidence ?? null,
      topByConfidence: byConfidence.slice(0, 3),
      topByLift: byLift.slice(0, 3),
      city: aprioriPayload?.city ?? null,
      generatedAt: aprioriPayload?.generated_at ?? results.apriori?.computed_at,
    };
  }, [aprioriPayload, aprioriRules, results.apriori?.computed_at]);

  const insightCards = useMemo(
    () =>
      buildInsightCards({
        arimaPoints: arimaForecast,
        dbscanClusters,
        aprioriRules,
      }),
    [aprioriRules, arimaForecast, dbscanClusters]
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  const hasAnyData = results.arima || results.dbscan || results.apriori;

  if (!hasAnyData) {
    return (
      <div className="rounded-3xl border border-gray-800 bg-gray-900/90 p-8">
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-950/40 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-gray-600" />
          <p className="text-sm font-medium text-gray-400">No analytics data yet</p>
          <p className="mt-1 max-w-md text-xs text-gray-600">
            ML results are computed nightly by GitHub Actions. Once the DBSCAN, ARIMA, and Apriori
            pipelines run, results will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: AnalyticsTab; label: string; icon: ReactNode }> = [
    { id: "overview", label: "Overview", icon: <Radar className="h-4 w-4" /> },
    { id: "rainfall", label: "Rainfall Forecast", icon: <CloudRain className="h-4 w-4" /> },
    { id: "clusters", label: "Incident Clusters", icon: <MapPin className="h-4 w-4" /> },
    { id: "patterns", label: "Weather Patterns", icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-sky-400/80">
              LGU Analytics Workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-50">Municipal risk intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              Review rainfall forecasts, incident clustering, and recurring weather associations in a
              single workspace designed for planning, monitoring, and response prioritization.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-100">
            Latest pipeline refresh:
            <span className="ml-2 font-medium text-white">
              {formatDateTime(
                results.arima?.computed_at ??
                  results.dbscan?.computed_at ??
                  results.apriori?.computed_at
              )}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="ARIMA Updated"
            value={formatDate(results.arima?.computed_at)}
            caption="Latest forecast run"
          />
          <SummaryCard
            label="Forecast Points"
            value={formatNumber(arimaMetrics.pointCount)}
            caption="Rainfall timeline entries"
          />
          <SummaryCard
            label="DBSCAN Clusters"
            value={formatNumber(dbscanMetrics.clusterCount)}
            caption="Detected hotspot groups"
          />
          <SummaryCard
            label="Top Hotspot"
            value={dbscanMetrics.topHotspot ?? "No data"}
            caption={
              dbscanMetrics.topIncidentCount != null
                ? `${dbscanMetrics.topIncidentCount} clustered incidents`
                : "No clustered incidents"
            }
          />
          <SummaryCard
            label="Apriori Rules"
            value={formatNumber(aprioriMetrics.rulesCount)}
            caption="Association rules loaded"
          />
          <SummaryCard
            label="Strongest Lift"
            value={formatNumber(aprioriMetrics.strongestLift ?? undefined, 2)}
            caption="Highest rule strength"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-800 bg-gray-900/80 p-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${
                isActive
                  ? "bg-sky-500/15 text-sky-100 ring-1 ring-sky-500/30"
                  : "text-gray-400 hover:bg-gray-800/80 hover:text-gray-200"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <SectionCard
              title="Rainfall Forecast Snapshot"
              subtitle={`Latest computed ${formatDate(results.arima?.computed_at)}`}
              icon={<TrendingUp className="h-4 w-4 text-sky-400" />}
            >
              {arimaForecast.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Peak forecast</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(arimaMetrics.highestPredicted ?? undefined, 1, " mm")}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(arimaMetrics.highestPredictedDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Average predicted</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(arimaMetrics.averagePredicted ?? undefined, 1, " mm")}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{formatNumber(arimaMetrics.pointCount)} forecast points</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {arimaMetrics.preview.map((point) => (
                      <div
                        key={point.date}
                        className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/40 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-200">{formatDate(point.date)}</p>
                          <p className="text-[11px] text-gray-500">Predicted rainfall</p>
                        </div>
                        <p className="text-sm font-semibold text-sky-300">
                          {formatNumber(point.predicted, 1, " mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyPanel
                  title="No rainfall forecast data"
                  body="The latest ARIMA run has not produced forecast points yet."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Cluster Hotspot Summary"
              subtitle={`Latest computed ${formatDate(results.dbscan?.computed_at)}`}
              icon={<GitBranch className="h-4 w-4 text-purple-400" />}
            >
              {dbscanMetrics.clusterCount > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-red-300/80">Primary hotspot</p>
                    <p className="mt-2 text-xl font-semibold text-red-100">
                      {dbscanMetrics.topHotspot ?? "No data"}
                    </p>
                    <p className="mt-1 text-sm text-red-200/80">
                      {dbscanMetrics.topIncidentCount != null
                        ? `${dbscanMetrics.topIncidentCount} incidents concentrated in the top cluster`
                        : "No clustered incidents"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] text-gray-500">Clusters</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(dbscanMetrics.clusterCount)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] text-gray-500">Noise</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(dbscanMetrics.noiseCount ?? undefined)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] text-gray-500">Silhouette</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(dbscanMetrics.silhouetteScore ?? undefined, 3)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyPanel
                  title="No hotspot clusters available"
                  body="The current DBSCAN payload does not include any cluster summaries yet."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Weather Pattern Highlights"
              subtitle={`Generated ${formatDate(aprioriMetrics.generatedAt)}`}
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            >
              {aprioriMetrics.rulesCount > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] text-gray-500">Rules</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(aprioriMetrics.rulesCount)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-[11px] text-gray-500">Strongest lift</p>
                      <p className="mt-2 text-lg font-semibold text-gray-100">
                        {formatNumber(aprioriMetrics.strongestLift ?? undefined, 2)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {aprioriMetrics.topByConfidence.map((rule, index) => (
                      <div
                        key={`${rule.ruleId ?? index}-overview`}
                        className="rounded-xl border border-gray-800 bg-gray-950/40 p-3"
                      >
                        <p className="text-xs font-medium text-gray-200">{rule.condition}</p>
                        <p className="mt-1 text-xs text-sky-300">Then {rule.result}</p>
                        <p className="mt-2 text-[11px] text-gray-500">
                          Confidence {formatNumber(rule.confidence * 100, 0, "%")} • Lift {formatNumber(rule.lift, 2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyPanel
                  title="No weather association rules"
                  body="The latest Apriori job has not produced rule outputs yet."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Operational Insights"
            subtitle="Short plain-language guidance derived from the currently loaded analytics"
            icon={<Sparkles className="h-4 w-4 text-sky-300" />}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {insightCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4"
                >
                  <p className="text-sm font-semibold text-gray-100">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{card.body}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "rainfall" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <SummaryCard
              label="Computed"
              value={formatDate(results.arima?.computed_at)}
              caption="Latest ARIMA run"
            />
            <SummaryCard
              label="Forecast Points"
              value={formatNumber(arimaMetrics.pointCount)}
              caption="Timeline entries"
            />
            <SummaryCard
              label="Latest Actual"
              value={formatNumber(arimaMetrics.latestActual ?? undefined, 1, " mm")}
              caption={formatDate(arimaMetrics.latestActualDate)}
            />
            <SummaryCard
              label="Peak Predicted"
              value={formatNumber(arimaMetrics.highestPredicted ?? undefined, 1, " mm")}
              caption={formatDate(arimaMetrics.highestPredictedDate)}
            />
            <SummaryCard
              label="Average Predicted"
              value={formatNumber(arimaMetrics.averagePredicted ?? undefined, 1, " mm")}
              caption={arimaMetrics.modelLabel ?? "Model metadata unavailable"}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <SectionCard
              title="Rainfall Forecast (ARIMA)"
              subtitle="Observed versus predicted rainfall from the latest model output"
              icon={<CloudRain className="h-4 w-4 text-sky-400" />}
            >
              {arimaForecast.length > 0 ? (
                <ARIMAChart data={results.arima?.result_json} />
              ) : (
                <EmptyPanel
                  title="No ARIMA forecast data"
                  body="The analytics store does not yet contain rainfall forecast points for this view."
                />
              )}
            </SectionCard>

            <div className="space-y-5">
              <SectionCard
                title="Forecast Interpretation"
                subtitle="Plain-language reading for planning and preparedness"
                icon={<TrendingUp className="h-4 w-4 text-amber-300" />}
              >
                <div className="space-y-3 text-sm leading-6 text-gray-400">
                  <p>
                    {arimaMetrics.highestPredictedDate
                      ? `Predicted rainfall remains most elevated on ${formatDate(arimaMetrics.highestPredictedDate)}, which is the current forecast peak for the loaded run.`
                      : "There is no forecast peak available yet because the ARIMA payload is empty."}
                  </p>
                  <p>
                    {arimaMetrics.averagePredicted != null
                      ? `Average predicted rainfall across the current forecast window is ${formatNumber(arimaMetrics.averagePredicted, 1, " mm")}. Use this view to anticipate flood-prone response demand and staffing pressure.`
                      : "Average predicted rainfall is unavailable because there are no valid forecast values to aggregate."}
                  </p>
                  <p>
                    {arimaMetrics.latestActual != null
                      ? `The latest observed rainfall point in the series is ${formatNumber(arimaMetrics.latestActual, 1, " mm")} on ${formatDate(arimaMetrics.latestActualDate)}.`
                      : "Observed rainfall points are not present in the latest payload."}
                  </p>
                </div>
              </SectionCard>

              <SectionCard
                title="Model Metadata"
                subtitle="Available run metadata from the stored analytics payload"
                icon={<BarChart3 className="h-4 w-4 text-gray-300" />}
              >
                <div className="space-y-3 text-sm text-gray-400">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Computed date</p>
                    <p className="mt-2 font-medium text-gray-100">{formatDateTime(results.arima?.computed_at)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Model label</p>
                    <p className="mt-2 font-medium text-gray-100">{arimaMetrics.modelLabel ?? "No metadata"}</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "clusters" ? (
        <div className="space-y-5">
          <SectionCard
            title="Incident Cluster Map"
            subtitle="Spatial concentration of historical SOS incidents based on the latest DBSCAN run"
            icon={<MapPin className="h-4 w-4 text-purple-400" />}
          >
            {dbscanMetrics.hasMapData ? (
              <DBSCANMap data={dbscanData} />
            ) : (
              <EmptyPanel
                title="No cluster points available"
                body="Run the DBSCAN seed script or nightly pipeline to populate the geospatial cluster map."
              />
            )}
          </SectionCard>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <SummaryCard
              label="Clusters"
              value={formatNumber(dbscanMetrics.clusterCount)}
              caption="Detected hotspot groups"
            />
            <SummaryCard
              label="Top Hotspot"
              value={dbscanMetrics.topHotspot ?? "No data"}
              caption={
                dbscanMetrics.topIncidentCount != null
                  ? `${dbscanMetrics.topIncidentCount} incidents in top cluster`
                  : "No hotspot identified"
              }
            />
            <SummaryCard
              label="Silhouette"
              value={formatNumber(dbscanMetrics.silhouetteScore ?? undefined, 3)}
              caption="Clustering separation score"
            />
            <SummaryCard
              label="Noise Count"
              value={formatNumber(dbscanMetrics.noiseCount ?? undefined)}
              caption="Outlier incidents"
            />
            <SummaryCard
              label="Clustered Incidents"
              value={formatNumber(dbscanMetrics.totalIncidents)}
              caption={`Computed ${formatDate(results.dbscan?.computed_at)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <SectionCard
              title="Cluster Breakdown"
              subtitle="Ranked incident hotspots with stronger emphasis on the most critical cluster"
              icon={<GitBranch className="h-4 w-4 text-purple-300" />}
            >
              <DBSCANView data={results.dbscan?.result_json} />
            </SectionCard>

            <SectionCard
              title="Planning Notes"
              subtitle="How to interpret this clustering output for LGU decision support"
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            >
              <div className="space-y-3 text-sm leading-6 text-gray-400">
                <p>
                  Higher cluster counts usually indicate several localized concentrations of response demand rather than one dominant hotspot.
                </p>
                <p>
                  A stronger silhouette score suggests clearer separation between hotspot areas, which makes prioritization more defensible.
                </p>
                <p>
                  Use the top hotspot barangay to guide pre-positioning of responders, evacuation readiness, and targeted information campaigns.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "patterns" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <SummaryCard
              label="Total Rules"
              value={formatNumber(aprioriMetrics.rulesCount)}
              caption="Association rules"
            />
            <SummaryCard
              label="Top Confidence"
              value={formatNumber(
                aprioriMetrics.strongestConfidence != null
                  ? aprioriMetrics.strongestConfidence * 100
                  : undefined,
                0,
                "%"
              )}
              caption="Best rule certainty"
            />
            <SummaryCard
              label="Top Lift"
              value={formatNumber(aprioriMetrics.strongestLift ?? undefined, 2)}
              caption="Strongest association strength"
            />
            <SummaryCard
              label="City"
              value={aprioriMetrics.city ?? "No data"}
              caption="Rule generation scope"
            />
            <SummaryCard
              label="Generated"
              value={formatDate(aprioriMetrics.generatedAt)}
              caption="Latest rules snapshot"
            />
          </div>

          <SectionCard
            title="How to read these rules"
            subtitle="Association rules show recurring historical weather combinations rather than deterministic causation"
            icon={<Sparkles className="h-4 w-4 text-amber-300" />}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                <p className="text-sm font-semibold text-gray-100">Confidence</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Higher confidence means the rule result appears more often when the stated condition is present.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                <p className="text-sm font-semibold text-gray-100">Lift</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Higher lift suggests a stronger-than-random relationship between the condition and the resulting weather pattern.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                <p className="text-sm font-semibold text-gray-100">Operational use</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Use these rules to support preparedness messaging, weather watch interpretation, and demand forecasting.
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard
              title="Top by Confidence"
              subtitle="Rules most likely to hold once the condition is present"
              icon={<TrendingUp className="h-4 w-4 text-sky-400" />}
            >
              {aprioriMetrics.topByConfidence.length > 0 ? (
                <div className="space-y-3">
                  {aprioriMetrics.topByConfidence.map((rule, index) => (
                    <div
                      key={`${rule.ruleId ?? index}-confidence`}
                      className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4"
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        Rule {rule.ruleId ?? index + 1}
                      </p>
                      <p className="mt-2 text-sm font-medium text-gray-100">{rule.condition}</p>
                      <p className="mt-2 text-sm text-sky-300">Then {rule.result}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-gray-400">
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Support {formatNumber(rule.support * 100, 1, "%")}
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Confidence {formatNumber(rule.confidence * 100, 0, "%")}
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Lift {formatNumber(rule.lift, 2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No confidence-ranked rules"
                  body="The current Apriori payload does not include rules to rank by confidence."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Top by Lift"
              subtitle="Rules with the strongest non-random association strength"
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            >
              {aprioriMetrics.topByLift.length > 0 ? (
                <div className="space-y-3">
                  {aprioriMetrics.topByLift.map((rule, index) => (
                    <div
                      key={`${rule.ruleId ?? index}-lift`}
                      className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4"
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        Rule {rule.ruleId ?? index + 1}
                      </p>
                      <p className="mt-2 text-sm font-medium text-gray-100">{rule.condition}</p>
                      <p className="mt-2 text-sm text-amber-300">Then {rule.result}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-gray-400">
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Support {formatNumber(rule.support * 100, 1, "%")}
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Confidence {formatNumber(rule.confidence * 100, 0, "%")}
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-900/80 px-2 py-2">
                          Lift {formatNumber(rule.lift, 2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No lift-ranked rules"
                  body="The current Apriori payload does not include rules to rank by lift."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="All Rules"
            subtitle="Complete association rule table for the latest analytics snapshot"
            icon={<BarChart3 className="h-4 w-4 text-gray-300" />}
          >
            <AprioriView data={results.apriori?.result_json} />
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
