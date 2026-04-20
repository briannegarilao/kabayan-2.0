// apps/web/lib/barangay-filter.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ── Context shape ─────────────────────────────────────────────
interface BarangayFilterContextValue {
  /** The currently selected barangay, or null for "All". */
  selectedBarangay: string | null;
  /** Update the filter. Pass null to clear. */
  setSelectedBarangay: (b: string | null) => void;
  /**
   * The user's home barangay (from their profile, if any).
   * Populated by the dashboard layout from the server-side user profile.
   */
  userBarangay: string | null;
}

const Ctx = createContext<BarangayFilterContextValue | null>(null);

// ── Persistence key ──────────────────────────────────────────
const STORAGE_KEY = "kabayan.barangayFilter";

// ── Provider ─────────────────────────────────────────────────
interface ProviderProps {
  children: ReactNode;
  /** User's barangay from their server-side profile (can be empty). */
  userBarangay?: string | null;
  /** User's role — if `barangay_official`, we auto-select their barangay. */
  userRole?: string | null;
}

export function BarangayFilterProvider({
  children,
  userBarangay,
  userRole,
}: ProviderProps) {
  const [selectedBarangay, setSelectedBarangayState] = useState<string | null>(
    null
  );

  // On mount: restore from sessionStorage, OR auto-apply user's barangay
  // if they're a barangay_official (they should only see their own by default).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setSelectedBarangayState(saved === "" ? null : saved);
        return;
      }
    } catch {
      /* storage unavailable — ignore */
    }

    // No saved value → auto-apply for barangay_officials.
    if (userRole === "barangay_official" && userBarangay) {
      setSelectedBarangayState(userBarangay);
    }
  }, [userRole, userBarangay]);

  // Persist on change so the filter survives page navigation
  const setSelectedBarangay = (b: string | null) => {
    setSelectedBarangayState(b);
    try {
      sessionStorage.setItem(STORAGE_KEY, b ?? "");
    } catch {
      /* storage unavailable — ignore */
    }
  };

  return (
    <Ctx.Provider
      value={{
        selectedBarangay,
        setSelectedBarangay,
        userBarangay: userBarangay ?? null,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useBarangayFilter(): BarangayFilterContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      "useBarangayFilter must be used within <BarangayFilterProvider>"
    );
  }
  return v;
}
