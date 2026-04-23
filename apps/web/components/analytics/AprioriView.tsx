"use client";

import { useMemo, useState } from "react";

interface Props { data: unknown; }

interface RuleInput {
  rule_id?: number;
  antecedent?: string;
  consequent?: string;
  condition?: string;
  result?: string;
  support?: number;
  confidence?: number;
  lift?: number;
}

interface NormalizedRule {
  ruleId: number | null;
  condition: string;
  result: string;
  support: number;
  confidence: number;
  lift: number;
}

type SortKey = "ruleId" | "condition" | "result" | "support" | "confidence" | "lift";
type SortDirection = "asc" | "desc";

function normalizeRule(rule: RuleInput): NormalizedRule {
  return {
    ruleId: typeof rule.rule_id === "number" ? rule.rule_id : null,
    condition: rule.condition ?? rule.antecedent ?? "—",
    result: rule.result ?? rule.consequent ?? "—",
    support: typeof rule.support === "number" ? rule.support : 0,
    confidence: typeof rule.confidence === "number" ? rule.confidence : 0,
    lift: typeof rule.lift === "number" ? rule.lift : 0,
  };
}

function getResultTone(result: string) {
  const value = result.toLowerCase();
  if (value.includes("flood")) return "bg-red-500/10 text-red-300 ring-red-500/20";
  if (value.includes("rain")) return "bg-sky-500/10 text-sky-300 ring-sky-500/20";
  if (value.includes("wind") || value.includes("breezy")) return "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20";
  return "bg-gray-500/10 text-gray-300 ring-gray-500/20";
}

function compareRules(
  a: NormalizedRule,
  b: NormalizedRule,
  sortKey: SortKey,
  direction: SortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  switch (sortKey) {
    case "condition":
      return a.condition.localeCompare(b.condition) * multiplier;
    case "result":
      return a.result.localeCompare(b.result) * multiplier;
    case "support":
      return (a.support - b.support) * multiplier;
    case "confidence":
      return (a.confidence - b.confidence) * multiplier;
    case "lift":
      return (a.lift - b.lift) * multiplier;
    case "ruleId":
    default:
      return ((a.ruleId ?? 0) - (b.ruleId ?? 0)) * multiplier;
  }
}

function SortHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  align = "left",
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  align?: "left" | "right";
  onClick: (sortKey: SortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;
  const arrow = !isActive ? "↕" : direction === "asc" ? "↑" : "↓";

  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 transition ${
          align === "right" ? "ml-auto" : ""
        } ${isActive ? "text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
      >
        <span>{label}</span>
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  );
}

export function AprioriView({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  if (!data) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No Apriori data. Pipeline has not run yet.</div>;
  }

  const parsed = data as { rules?: RuleInput[] };
  const rules = (parsed.rules || []).map(normalizeRule);

  if (rules.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-gray-500">No association rules found.</div>;
  }

  const sorted = useMemo(
    () => [...rules].sort((a, b) => compareRules(a, b, sortKey, sortDirection)),
    [rules, sortDirection, sortKey]
  );

  function handleSort(nextSortKey: SortKey) {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "condition" || nextSortKey === "result" ? "asc" : "desc");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-800">
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 text-[10px] uppercase tracking-[0.16em] text-gray-500 backdrop-blur">
            <tr>
              <SortHeader
                label="Rule"
                sortKey="ruleId"
                activeSortKey={sortKey}
                direction={sortDirection}
                onClick={handleSort}
              />
              <SortHeader
                label="Condition"
                sortKey="condition"
                activeSortKey={sortKey}
                direction={sortDirection}
                onClick={handleSort}
              />
              <SortHeader
                label="Result"
                sortKey="result"
                activeSortKey={sortKey}
                direction={sortDirection}
                onClick={handleSort}
              />
              <SortHeader
                label="Support"
                sortKey="support"
                activeSortKey={sortKey}
                direction={sortDirection}
                align="right"
                onClick={handleSort}
              />
              <SortHeader
                label="Confidence"
                sortKey="confidence"
                activeSortKey={sortKey}
                direction={sortDirection}
                align="right"
                onClick={handleSort}
              />
              <SortHeader
                label="Lift"
                sortKey="lift"
                activeSortKey={sortKey}
                direction={sortDirection}
                align="right"
                onClick={handleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80 bg-gray-900/30">
            {sorted.map((rule, index) => (
              <tr key={`${rule.ruleId ?? index}-row`} className="align-top">
                <td className="px-4 py-4 text-gray-400">
                  <span className="rounded-lg border border-gray-800 bg-gray-950/50 px-2 py-1 text-[11px]">
                    {rule.ruleId ?? index + 1}
                  </span>
                </td>
                <td className="max-w-md px-4 py-4 text-sm leading-6 text-gray-200">
                  {rule.condition}
                </td>
                <td className="max-w-sm px-4 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${getResultTone(rule.result)}`}>
                    {rule.result}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-mono text-gray-400">
                  {(rule.support * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-4 text-right font-mono text-gray-300">
                  {(rule.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-4 text-right font-mono text-gray-300">
                  {rule.lift.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
