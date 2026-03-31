// apps/web/components/map/KabayanMap.tsx
"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// CRITICAL: Leaflet uses window object — must be client-only
// dynamic import with ssr: false prevents Next.js hydration errors
const MapContent = dynamic(() => import("./MapContent"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[600px] rounded-lg" />,
});

export default function KabayanMap() {
  return <MapContent />;
}
