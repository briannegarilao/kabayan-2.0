"use client";

import dynamic from "next/dynamic";
import { CompactDashboardStats } from "../../components/dashboard/CompactDashboardStats";
import { FloatingSimulationLogPanel } from "../../components/dashboard/FloatingSimulationLogPanel";
import { SimulationModeBanner } from "../../components/dashboard/SimulationModeBanner";
import { SalitranSimulationControls } from "../../components/dashboard/SalitranSimulationControls";

const LiveMapView = dynamic(() => import("../../components/map/LiveMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <p className="text-xs text-gray-500">Loading dashboard map...</p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <SimulationModeBanner />
      <SalitranSimulationControls />
      <CompactDashboardStats />

      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div className="h-[calc(100vh-13.5rem)] min-h-[620px]">
          <LiveMapView />
        </div>

        <FloatingSimulationLogPanel />
      </div>
    </div>
  );
}
