// apps/web/app/dashboard/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, GitBranch, AlertTriangle } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { ARIMAChart } from "../../../components/analytics/ARIMAChart";
import { DBSCANView } from "../../../components/analytics/DBSCANView";
import { AprioriView } from "../../../components/analytics/AprioriView";

const supabase = createClient();

interface MLResult {
  model_type: string;
  result_json: unknown;
  computed_at: string;
}

export default function AnalyticsPage() {
  const [results, setResults] = useState<Record<string, MLResult | null>>({
    arima: null,
    dbscan: null,
    apriori: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchML() {
      // Fetch latest result for each model type in parallel
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
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">No analytics data yet</p>
        <p className="mt-1 max-w-md text-xs text-gray-600">
          ML results are computed nightly by GitHub Actions. Once the DBSCAN, ARIMA, and Apriori
          pipelines run, results will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ARIMA Rainfall Forecast */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-medium text-gray-200">Rainfall Forecast (ARIMA)</h3>
          {results.arima && (
            <span className="ml-auto text-[10px] text-gray-500">
              Computed: {new Date(results.arima.computed_at).toLocaleDateString("en-PH")}
            </span>
          )}
        </div>
        <ARIMAChart data={results.arima?.result_json} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* DBSCAN Clusters */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-medium text-gray-200">Incident Clusters (DBSCAN)</h3>
          </div>
          <DBSCANView data={results.dbscan?.result_json} />
        </div>

        {/* Apriori Rules */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-medium text-gray-200">Weather Patterns (Apriori)</h3>
          </div>
          <AprioriView data={results.apriori?.result_json} />
        </div>
      </div>
    </div>
  );
}
