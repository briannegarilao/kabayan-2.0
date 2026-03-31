// apps/web/components/analytics/AprioriView.tsx
"use client";

interface Props { data: unknown; }

// Expected shape: { rules: [{ antecedent: "High Humidity, Cloudy", consequent: "Rain", support: 0.45, confidence: 0.82, lift: 1.5 }] }
interface Rule {
  antecedent: string;
  consequent: string;
  support: number;
  confidence: number;
  lift: number;
}

export function AprioriView({ data }: Props) {
  if (!data) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No Apriori data. Pipeline has not run yet.</div>;
  }

  const parsed = data as { rules?: Rule[] };
  const rules = parsed.rules || [];

  if (rules.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No association rules found.</div>;
  }

  // Sort by confidence descending
  const sorted = [...rules].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 border-b border-gray-700 bg-gray-900 text-[10px] uppercase text-gray-500">
          <tr>
            <th className="pb-2 pr-2">If (Conditions)</th>
            <th className="pb-2 pr-2">Then</th>
            <th className="pb-2 pr-2 text-right">Conf.</th>
            <th className="pb-2 text-right">Lift</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rule, i) => (
            <tr key={i} className="border-b border-gray-800/50">
              <td className="py-2 pr-2 text-gray-300">{rule.antecedent}</td>
              <td className="py-2 pr-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  rule.consequent.toLowerCase().includes("flood")
                    ? "bg-red-500/10 text-red-400"
                    : rule.consequent.toLowerCase().includes("rain")
                    ? "bg-sky-500/10 text-sky-400"
                    : "bg-gray-500/10 text-gray-400"
                }`}>
                  {rule.consequent}
                </span>
              </td>
              <td className="py-2 pr-2 text-right font-mono text-gray-400">
                {(rule.confidence * 100).toFixed(0)}%
              </td>
              <td className="py-2 text-right font-mono text-gray-400">
                {rule.lift.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
