"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Users,
  BarChart3,
  Building2,
  Megaphone,
  Shield,
  LogOut,
  Map as MapIcon,
  Wrench,
  PlayCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { BarangayFilter } from "./BarangayFilter";
import { isDevConsoleEnabledForClient } from "../../lib/dev-console";

interface UserProfile {
  fullName: string;
  role: string;
  barangay: string;
  email: string;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: MapIcon },
  { label: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle },
  { label: "Responders", href: "/dashboard/responders", icon: Users },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Evacuation", href: "/dashboard/evacuation", icon: Building2 },
  { label: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
];

const SIDEBAR_STORAGE_KEY = "kabayan-dashboard-sidebar-collapsed";

export function Sidebar({ userProfile }: { userProfile: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  const showDevConsole = isDevConsoleEnabledForClient(userProfile.role);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      // ignore persisted state failures
    }
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          next ? "1" : "0",
        );
      } catch {
        // ignore persisted state failures
      }
      return next;
    });
  }

  const roleDisplay =
    userProfile.role === "lgu_admin"
      ? "LGU Administrator"
      : "Barangay Official";

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-gray-800 bg-gray-900 transition-[width] duration-200 ${
        collapsed ? "w-[88px]" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center border-b border-gray-800 ${
          collapsed ? "justify-center px-3" : "gap-3 px-5"
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        {!collapsed ? (
          <>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-white">
                KABAYAN
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Emergency Response
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="ml-auto hidden rounded-lg border border-gray-800 bg-gray-950/60 p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 xl:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute top-4 right-3 hidden rounded-lg border border-gray-800 bg-gray-950/70 p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 xl:inline-flex"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className={`space-y-1 py-4 ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/dashboard/map"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed
                    ? "justify-center px-2"
                    : "items-center gap-3 px-3"
                } ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] ${
                    isActive ? "text-blue-400" : "text-gray-500"
                  }`}
                />
                {!collapsed ? item.label : null}
                {isActive && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
              </Link>
            );
          })}

          {showDevConsole && (
            <>
              <div className="my-3 border-t border-gray-800" />

              <Link
                href="/dashboard/dev"
                title={collapsed ? "Dev Console" : undefined}
                className={`flex rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed
                    ? "justify-center px-2"
                    : "items-center gap-3 px-3"
                } ${
                  pathname.startsWith("/dashboard/dev")
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-gray-400 hover:bg-amber-500/5 hover:text-amber-300"
                }`}
              >
                <Wrench
                  className={`h-[18px] w-[18px] ${
                    pathname.startsWith("/dashboard/dev")
                      ? "text-amber-400"
                      : "text-gray-500"
                  }`}
                />
                {!collapsed ? (
                  <>
                    Dev Console
                    <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                      Dev
                    </span>
                  </>
                ) : null}
              </Link>

              <Link
                href="/dashboard/salitran-iv-sim"
                title={collapsed ? "Salitran IV Sim" : undefined}
                className={`flex rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed
                    ? "justify-center px-2"
                    : "items-center gap-3 px-3"
                } ${
                  pathname.startsWith("/dashboard/salitran-iv-sim")
                    ? "bg-violet-500/10 text-violet-300"
                    : "text-gray-400 hover:bg-violet-500/5 hover:text-violet-300"
                }`}
              >
                <PlayCircle
                  className={`h-[18px] w-[18px] ${
                    pathname.startsWith("/dashboard/salitran-iv-sim")
                      ? "text-violet-300"
                      : "text-gray-500"
                  }`}
                />
                {!collapsed ? (
                  <>
                    Salitran IV Sim
                    <span className="ml-auto rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                      Sim
                    </span>
                  </>
                ) : null}
              </Link>
            </>
          )}
        </nav>

        {!collapsed ? (
          <div className="mx-3 mb-4 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <BarangayFilter />
          </div>
        ) : null}
      </div>

      <div className={`border-t border-gray-800 ${collapsed ? "p-3" : "p-4"}`}>
        {!collapsed ? (
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-gray-200">
              {userProfile.fullName}
            </p>
            <p className="truncate text-xs text-gray-500">{roleDisplay}</p>
            {userProfile.barangay && (
              <p className="truncate text-xs text-gray-600">
                {userProfile.barangay}
              </p>
            )}
          </div>
        ) : null}
        <button
          onClick={handleSignOut}
          title={collapsed ? "Sign out" : undefined}
          className={`flex rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
            collapsed ? "w-full justify-center" : "w-full items-center gap-2"
          }`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </aside>
  );
}
