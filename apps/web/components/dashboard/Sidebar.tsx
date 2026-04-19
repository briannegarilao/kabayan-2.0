// apps/web/components/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  BarChart3,
  Building2,
  Megaphone,
  Shield,
  LogOut,
  Map as MapIcon,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useRouter } from "next/navigation";

interface UserProfile {
  fullName: string;
  role: string;
  barangay: string;
  email: string;
}

const navItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Incidents",
    href: "/dashboard/incidents",
    icon: AlertTriangle,
  },
  {
    label: "Responders",
    href: "/dashboard/responders",
    icon: Users,
  },
  {
    label: "Live Map",
    href: "/dashboard/map",
    icon: MapIcon,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    label: "Evacuation",
    href: "/dashboard/evacuation",
    icon: Building2,
  },
  {
    label: "Announcements",
    href: "/dashboard/announcements",
    icon: Megaphone,
  },
];

export function Sidebar({ userProfile }: { userProfile: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Format role for display
  const roleDisplay =
    userProfile.role === "lgu_admin"
      ? "LGU Administrator"
      : "Barangay Official";

  return (
    <aside className="flex w-64 flex-col border-r border-gray-800 bg-gray-900">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            KABAYAN
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            Emergency Response
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          // Exact match for /dashboard, startsWith for sub-pages
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
              {item.label}

              {/* Active indicator bar */}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile + sign out at the bottom */}
      <div className="border-t border-gray-800 p-4">
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
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
