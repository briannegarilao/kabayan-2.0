// apps/web/components/incidents/IncidentFilters.tsx
"use client";

import { Search } from "lucide-react";

interface Props {
  statusFilter: string;
  severityFilter: string;
  searchQuery: string;
  onStatusChange: (v: string) => void;
  onSeverityChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  totalCount: number;
  filteredCount: number;
}

const selectClass =
  "rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500";

export function IncidentFilters({
  statusFilter, severityFilter, searchQuery,
  onStatusChange, onSeverityChange, onSearchChange,
  totalCount, filteredCount,
}: Props) {
  return (
    <div className="border-b border-gray-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search barangay or message..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-1.5 pl-8 pr-3 text-xs text-gray-300 placeholder-gray-500 outline-none focus:border-blue-500"
          />
        </div>

        {/* Status filter */}
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} className={selectClass}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
        </select>

        {/* Severity filter */}
        <select value={severityFilter} onChange={(e) => onSeverityChange(e.target.value)} className={selectClass}>
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>

        {/* Count */}
        <span className="text-[10px] text-gray-500">
          {filteredCount} of {totalCount}
        </span>
      </div>
    </div>
  );
}
