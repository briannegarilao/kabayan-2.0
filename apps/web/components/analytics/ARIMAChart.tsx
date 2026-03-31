// apps/web/components/analytics/ARIMAChart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

interface Props {
  data: unknown;
}

// Expected shape from ml_results.result_json for arima:
// { forecast: [{ date: "2026-04-01", actual: 12.5, predicted: 11.8 }, ...] }
interface ForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
}

export function ARIMAChart({ data }: Props) {
  if (!data) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-gray-500">
        No ARIMA forecast data available. Pipeline has not run yet.
      </div>
    );
  }

  const parsed = data as { forecast?: ForecastPoint[] };
  const forecast = parsed.forecast || [];

  if (forecast.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-gray-500">
        Forecast data is empty.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={forecast} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} unit="mm" />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual Rainfall" />
        <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="ARIMA Forecast" />
      </LineChart>
    </ResponsiveContainer>
  );
}
