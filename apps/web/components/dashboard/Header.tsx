// apps/web/components/dashboard/Header.tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, Clock } from "lucide-react";
import { BarangayFilterIndicator } from "./BarangayFilterIndicator";

interface UserProfile {
  fullName: string;
  role: string;
  barangay: string;
  email: string;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/incidents": "Incident Management",
  "/dashboard/responders": "Responder Tracking",
  "/dashboard/map": "Live Map",
  "/dashboard/analytics": "Analytics & Insights",
  "/dashboard/evacuation": "Evacuation Centers",
  "/dashboard/announcements": "Announcements",
};

export function Header({ userProfile }: { userProfile: UserProfile }) {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    function updateTime() {
      setCurrentTime(
        new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Manila",
        })
      );
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const pageTitle = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-6 backdrop-blur-sm">
      {/* Left: Page title */}
      <div>
        <h2 className="text-lg font-semibold text-white">{pageTitle}</h2>
        <p className="text-xs text-gray-500">
          Dasmariñas City, Cavite &mdash;{" "}
          {new Date().toLocaleDateString("en-PH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Manila",
          })}
        </p>
      </div>

      {/* Right: barangay indicator + connection + clock */}
      <div className="flex items-center gap-4">
        <BarangayFilterIndicator />

        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? "Connected" : "Offline"}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span className="font-mono">{currentTime}</span>
        </div>
      </div>
    </header>
  );
}
