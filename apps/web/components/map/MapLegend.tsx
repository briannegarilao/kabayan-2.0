export function MapLegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border border-gray-800 bg-gray-900/95 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="text-gray-500">Severity:</span>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Low
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Moderate
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#f97316]" /> High
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Critical
        </div>
      </div>
    </div>
  );
}
